
"""Validation of the cleaned Diabetes 130-US Hospitals dataset before SQL loading.

Owner: Member 4 (ETL + Database).

This module ONLY detects and reports. It never changes, fixes or deletes data.

Severity levels:
ERROR   - Data would be stored incorrectly or information would be lost.
          Any ERROR blocks SQL loading.
WARNING - Data can be loaded, but should be reviewed.
INFO    - Useful facts for the data-quality report.

Main entry points:
validate_cleaned_data()
generate_validation_report()
has_critical_errors()
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import pandas as pd

from cleaning import (
    CLEANED_COLUMNS,
    COLUMN_SPEC,
    DIAGNOSIS_COLUMNS,
    DIAGNOSIS_ZERO_PAD_CODES,
    EXPIRED_DISPOSITION_IDS,
    HOSPICE_DISPOSITION_IDS,
    ICD9_PATTERN,
    LOOKUP_TABLES,
    MEDICATION_COLUMNS,
    MISSING_MARKER,
    RAW_TO_CLEAN_NAMES,
    READMISSION_STATUS_VALUES,
    UNKNOWN_GENDER,
    CleaningResult,
    ColumnSpec,
    parse_sql_integer,
)

ERROR, WARNING, INFO = "ERROR", "WARNING", "INFO"
SAMPLE_SIZE = 5

MEDICATION_SQL_COLUMNS = list(MEDICATION_COLUMNS.values())

INT_COUNT_COLUMNS = [
    "LengthOfStayDays",
    "NumLabTests",
    "NumProcedures",
    "NumMedications",
    "NumOutpatientVisits",
    "NumEmergencyVisits",
    "NumPriorAdmissions",
    "NumDiagnoses",
]

SOURCE_RANGES = {"LengthOfStayDays": (1, 14)}

PATIENT_LEVEL_COLUMNS = [
    "PatientRace",
    "PatientGender",
    "PatientDemographicConflict",
]

DEDICATED_VALUE_CHECKS = {
    "ReadmissionStatus",
    *MEDICATION_SQL_COLUMNS,
}


# ============================================================
# 1. RESULT STRUCTURES
# ============================================================

@dataclass
class ValidationIssue:
    rule: str
    column: str | None
    row_count: int
    severity: str = WARNING
    details: str = ""
    sample_ids: list[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    is_valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)
    passed: list[str] = field(default_factory=list)
    checks_run: list[str] = field(default_factory=list)
    total_rows: int = 0

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == ERROR]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == WARNING]

    @property
    def infos(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == INFO]


# ============================================================
# 2. HELPERS
# ============================================================

def _has(df: pd.DataFrame, *columns: str) -> bool:
    return all(c in df.columns for c in columns)


def _sample(df: pd.DataFrame, mask: pd.Series) -> list[str]:
    if "ExternalAdmissionId" not in df.columns:
        return []

    mask = pd.Series(mask, index=df.index).fillna(False).astype(bool)

    return (
        df.loc[mask, "ExternalAdmissionId"]
        .astype("string")
        .head(SAMPLE_SIZE)
        .tolist()
    )


def _issue(rule, column, mask_or_count, severity, details, df=None):
    if isinstance(mask_or_count, pd.Series):
        mask = pd.Series(
            mask_or_count,
            index=mask_or_count.index
        ).fillna(False).astype(bool)

        return ValidationIssue(
            rule,
            column,
            int(mask.sum()),
            severity,
            details,
            _sample(df, mask) if df is not None else [],
        )

    return ValidationIssue(
        rule,
        column,
        int(mask_or_count),
        severity,
        details,
    )


def _spec(name: str) -> ColumnSpec:
    for spec in COLUMN_SPEC:
        if spec.name == name:
            return spec

    raise KeyError(f"ColumnSpec not found for: {name}")


def _nvarchar_length(sql_type: str) -> int | None:
    match = re.fullmatch(r"NVARCHAR\((\d+)\)", sql_type)
    return int(match.group(1)) if match else None


# ============================================================
# 3. INDIVIDUAL CHECKS
# ============================================================

def check_required_columns(
    df: pd.DataFrame,
    required: list[str] | None = None
) -> list[ValidationIssue]:

    required = CLEANED_COLUMNS if required is None else required

    return [
        ValidationIssue(
            "missing_column",
            col,
            len(df),
            ERROR,
            f"Column {col} is missing from the cleaned data",
        )
        for col in required
        if col not in df.columns
    ]


def check_unexpected_columns(df: pd.DataFrame) -> list[ValidationIssue]:

    return [
        ValidationIssue(
            "unexpected_column",
            col,
            len(df),
            ERROR,
            f"Column {col} has no database target. "
            "Map it in COLUMN_SPEC and the SQL migration.",
        )
        for col in df.columns
        if col not in CLEANED_COLUMNS
    ]


def check_null_values(
    df: pd.DataFrame,
    cleaning_result: CleaningResult | None = None
) -> list[ValidationIssue]:

    issues = []

    recorded = {}

    if (
        cleaning_result is not None
        and cleaning_result.invalid_values is not None
        and len(cleaning_result.invalid_values)
        and "Column" in cleaning_result.invalid_values.columns
    ):
        recorded = (
            cleaning_result.invalid_values["Column"]
            .value_counts()
            .to_dict()
        )

    for spec in COLUMN_SPEC:

        if not spec.required or spec.name not in df.columns:
            continue

        nulls = df[spec.name].isna()

        if nulls.any():

            why = (
                "database column is NOT NULL"
                if not spec.nullable
                else "required by the dataset contract"
            )

            extra = (
                f"; {recorded[spec.name]} invalid source values "
                "were recorded by cleaning"
                if spec.name in recorded
                else ""
            )

            issues.append(
                _issue(
                    "null_in_required_column",
                    spec.name,
                    nulls,
                    ERROR,
                    f"NULL values in required column ({why}){extra}",
                    df,
                )
            )

    return issues


def check_sql_types(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    for spec in COLUMN_SPEC:

        if spec.name not in df.columns:
            continue

        values = df[spec.name]

        if spec.sql_type in ("INT", "BIT"):

            _, invalid = parse_sql_integer(
                values,
                spec.sql_type
            )

            if invalid.any():

                issues.append(
                    _issue(
                        "invalid_sql_type",
                        spec.name,
                        invalid,
                        ERROR,
                        f"Values are not valid {spec.sql_type}: "
                        f"{values[invalid].astype('string').unique()[:5].tolist()}",
                        df,
                    )
                )

        elif spec.sql_type.startswith("NVARCHAR"):

            not_text = (
                values.notna()
                & ~values.map(
                    lambda value: isinstance(value, str)
                ).astype(bool)
            )

            if not_text.any():

                issues.append(
                    _issue(
                        "invalid_sql_type",
                        spec.name,
                        not_text,
                        ERROR,
                        f"{spec.sql_type} column contains non-text values",
                        df,
                    )
                )

    return issues


def check_nvarchar_lengths(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    for spec in COLUMN_SPEC:

        limit = _nvarchar_length(spec.sql_type)

        if limit is None or spec.name not in df.columns:
            continue

        lengths = df[spec.name].astype("string").str.len()

        too_long = (lengths > limit).fillna(False)

        if too_long.any():

            issues.append(
                _issue(
                    "text_too_long",
                    spec.name,
                    too_long,
                    ERROR,
                    f"Longer than {spec.sql_type}. "
                    f"Maximum length found: {int(lengths.max())}",
                    df,
                )
            )

    return issues


def check_value_ranges(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    for col in INT_COUNT_COLUMNS:

        if col not in df.columns:
            continue

        values, _ = parse_sql_integer(df[col], "INT")

        negative = (values < 0).fillna(False)

        if negative.any():

            issues.append(
                _issue(
                    "negative_count",
                    col,
                    negative,
                    ERROR,
                    "Count value is below 0",
                    df,
                )
            )

    for col, (low, high) in SOURCE_RANGES.items():

        if col not in df.columns:
            continue

        values, _ = parse_sql_integer(df[col], "INT")

        outside = (
            (values < low) | (values > high)
        ).fillna(False)

        if outside.any():

            issues.append(
                _issue(
                    "outside_source_range",
                    col,
                    outside,
                    WARNING,
                    f"Outside documented source range {low}-{high}",
                    df,
                )
            )

    return issues


def check_allowed_values(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    for spec in COLUMN_SPEC:

        if (
            spec.allowed is None
            or spec.sql_type in ("INT", "BIT")
            or spec.name in DEDICATED_VALUE_CHECKS
            or spec.name not in df.columns
        ):
            continue

        values = df[spec.name]

        bad = values.notna() & ~values.isin(spec.allowed)

        if bad.any():

            severity = ERROR if spec.db_check else WARNING

            issues.append(
                _issue(
                    "value_not_allowed",
                    spec.name,
                    bad,
                    severity,
                    f"Unexpected values: "
                    f"{values[bad].astype('string').unique()[:10].tolist()}",
                    df,
                )
            )

    return issues


def check_diagnosis_codes(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    for col in DIAGNOSIS_COLUMNS:

        if col not in df.columns:
            continue

        codes = df[col].astype("string")

        bad = (
            codes.notna()
            & ~codes.fillna("").str.match(ICD9_PATTERN)
        )

        if bad.any():

            issues.append(
                _issue(
                    "invalid_icd9_format",
                    col,
                    bad,
                    WARNING,
                    f"Codes not in ICD-9-CM format: "
                    f"{codes[bad].unique()[:10].tolist()}",
                    df,
                )
            )

    return issues


def check_readmission_labels(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    if not _has(df, "ReadmissionStatus"):
        return issues

    status = df["ReadmissionStatus"]

    bad = status.notna() & ~status.isin(READMISSION_STATUS_VALUES)

    if bad.any():

        issues.append(
            _issue(
                "invalid_readmission_status",
                "ReadmissionStatus",
                bad,
                ERROR,
                f"Allowed values: {list(READMISSION_STATUS_VALUES)}; "
                f"found: {status[bad].astype('string').unique()[:10].tolist()}",
                df,
            )
        )

    if _has(df, "Readmitted30Days"):

        label, _ = parse_sql_integer(
            df["Readmitted30Days"],
            "BIT"
        )

        expected = (status == "<30").astype("Int64")

        mismatch = (
            status.isin(READMISSION_STATUS_VALUES)
            & (label.isna() | (label != expected))
        ).fillna(False)

        if mismatch.any():

            issues.append(
                _issue(
                    "readmitted30days_mismatch",
                    "Readmitted30Days",
                    mismatch,
                    ERROR,
                    "Must be 1 when ReadmissionStatus is '<30', otherwise 0",
                    df,
                )
            )

    return issues


def check_discharge_flags(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    if not _has(df, "DischargeDispositionId"):
        return issues

    disposition, _ = parse_sql_integer(
        df["DischargeDispositionId"],
        "INT"
    )

    for col, ids in (
        ("ExpiredAtDischarge", EXPIRED_DISPOSITION_IDS),
        ("DischargedToHospice", HOSPICE_DISPOSITION_IDS),
    ):

        if col not in df.columns:
            continue

        flag, _ = parse_sql_integer(df[col], "BIT")

        expected = (
            disposition.isin(ids)
            .fillna(False)
            .astype("Int64")
        )

        mismatch = (
            flag.isna() | (flag != expected)
        ).fillna(True)

        if mismatch.any():

            issues.append(
                _issue(
                    "discharge_flag_mismatch",
                    col,
                    mismatch,
                    ERROR,
                    f"Must be 1 exactly when DischargeDispositionId "
                    f"is in {list(ids)}",
                    df,
                )
            )

    return issues


def check_medications(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    present = [
        col for col in MEDICATION_SQL_COLUMNS
        if col in df.columns
    ]

    for col in present:

        allowed = _spec(col).allowed

        bad = (
            df[col].notna()
            & ~df[col].isin(allowed)
        )

        if bad.any():

            issues.append(
                _issue(
                    "invalid_medication_value",
                    col,
                    bad,
                    ERROR,
                    f"Allowed values: {list(allowed)}; "
                    f"found: {df.loc[bad, col].astype('string').unique()[:10].tolist()}",
                    df,
                )
            )

    if len(present) != len(MEDICATION_SQL_COLUMNS):
        return issues

    meds = df[MEDICATION_SQL_COLUMNS]

    any_prescribed = (
        meds.notna() & (meds != "No")
    ).any(axis=1)

    any_dose_change = meds.isin(
        ["Up", "Down"]
    ).any(axis=1)

    if _has(df, "DiabetesMedPrescribed"):

        flag, _ = parse_sql_integer(
            df["DiabetesMedPrescribed"],
            "BIT"
        )

        mismatch = (
            flag.notna()
            & (flag != any_prescribed.astype("Int64"))
        ).fillna(False)

        if mismatch.any():

            issues.append(
                _issue(
                    "diabetes_med_flag_mismatch",
                    "DiabetesMedPrescribed",
                    mismatch,
                    WARNING,
                    "Flag disagrees with the 23 medication columns",
                    df,
                )
            )

    if _has(df, "MedicationChanged"):

        flag, _ = parse_sql_integer(
            df["MedicationChanged"],
            "BIT"
        )

        missing_change = (
            any_dose_change & (flag == 0)
        ).fillna(False)

        if missing_change.any():

            issues.append(
                _issue(
                    "medication_change_flag_mismatch",
                    "MedicationChanged",
                    missing_change,
                    WARNING,
                    "A medication went Up/Down but MedicationChanged is 0",
                    df,
                )
            )

        other_change = (
            (flag == 1) & ~any_dose_change
        ).fillna(False)

        if other_change.any():

            issues.append(
                _issue(
                    "medication_change_without_dose_change",
                    "MedicationChanged",
                    other_change,
                    INFO,
                    "MedicationChanged=1 without an Up/Down dose change. "
                    "The source also records other medication changes.",
                    df,
                )
            )

    return issues


def check_unique_admissions(
    df: pd.DataFrame,
    cleaning_result: CleaningResult | None = None
) -> list[ValidationIssue]:

    issues = []

    if _has(df, "ExternalAdmissionId"):

        dup = df["ExternalAdmissionId"].duplicated(
            keep=False
        )

        if dup.any():

            issues.append(
                _issue(
                    "duplicate_admission_id",
                    "ExternalAdmissionId",
                    dup,
                    ERROR,
                    "The same encounter appears on more than one row",
                    df,
                )
            )

    exact = (
        cleaning_result.exact_duplicate_rows
        if cleaning_result is not None
        else int(df.duplicated(keep=False).sum())
    )

    if exact:

        issues.append(
            ValidationIssue(
                "exact_duplicate_rows",
                None,
                exact,
                ERROR,
                "Fully identical rows were kept. Review the source before loading.",
            )
        )

    return issues


def check_patient_consistency(df: pd.DataFrame) -> list[ValidationIssue]:

    issues = []

    needed = [
        "ExternalPatientId",
        "RaceAtAdmission",
        "GenderAtAdmission",
        *PATIENT_LEVEL_COLUMNS,
    ]

    if not _has(df, *needed):
        return issues

    patient = df["ExternalPatientId"]

    for col in PATIENT_LEVEL_COLUMNS:

        distinct = (
            df.groupby("ExternalPatientId")[col]
            .nunique(dropna=False)
        )

        varies = patient.map(distinct) > 1

        if varies.any():

            issues.append(
                _issue(
                    "patient_value_inconsistent",
                    col,
                    varies,
                    ERROR,
                    "Patient-level value differs between stays of the same patient",
                    df,
                )
            )

    if issues:
        return issues

    gender_known = df["GenderAtAdmission"].mask(
        df["GenderAtAdmission"] == UNKNOWN_GENDER,
        pd.NA
    )

    n_race = (
        df["RaceAtAdmission"]
        .groupby(patient)
        .transform("nunique")
    )

    n_gender = (
        gender_known
        .groupby(patient)
        .transform("nunique")
    )

    conflict, _ = parse_sql_integer(
        df["PatientDemographicConflict"],
        "BIT"
    )

    expected_conflict = (
        (n_race > 1) | (n_gender > 1)
    ).astype("Int64")

    bad_flag = (
        conflict != expected_conflict
    ).fillna(True)

    if bad_flag.any():

        issues.append(
            _issue(
                "demographic_conflict_flag_mismatch",
                "PatientDemographicConflict",
                bad_flag,
                ERROR,
                "Flag disagrees with admission-level race/gender values",
                df,
            )
        )

    for col, admission_values, n_known in (
        ("PatientRace", df["RaceAtAdmission"], n_race),
        ("PatientGender", gender_known, n_gender),
    ):

        value = df[col]

        wrong_when_agreed = (
            (n_known == 1)
            & admission_values.notna()
            & (value != admission_values)
        )

        wrong_when_not = (
            (n_known != 1)
            & value.notna()
        )

        bad = (
            wrong_when_agreed | wrong_when_not
        ).fillna(True)

        if bad.any():

            issues.append(
                _issue(
                    "patient_value_mismatch",
                    col,
                    bad,
                    ERROR,
                    "Must equal the single known admission value, "
                    "and be NULL when values are missing or conflicting",
                    df,
                )
            )

    return issues


def check_foreign_keys(
    df: pd.DataFrame,
    id_mappings: dict[str, pd.DataFrame] | None,
    cleaning_result: CleaningResult | None = None
) -> list[ValidationIssue]:

    if id_mappings is None:

        if (
            cleaning_result is not None
            and len(cleaning_result.unknown_lookup_ids)
        ):

            return [
                ValidationIssue(
                    "foreign_key_missing",
                    col,
                    int(len(group)),
                    ERROR,
                    "IDs not found in IDS_mapping.csv",
                )
                for col, group in cleaning_result.unknown_lookup_ids.groupby("Column")
            ]

        return [
            ValidationIssue(
                "foreign_keys_not_checked",
                None,
                0,
                WARNING,
                "id_mappings not supplied; lookup IDs were not verified",
            )
        ]

    issues = []

    for id_col, (_, table) in LOOKUP_TABLES.items():

        if id_col not in df.columns:
            continue

        if table not in id_mappings:

            issues.append(
                ValidationIssue(
                    "lookup_table_missing",
                    id_col,
                    len(df),
                    ERROR,
                    f"Expected lookup table '{table}' is missing from id_mappings",
                )
            )
            continue

        mapping_df = id_mappings[table]

        if not isinstance(mapping_df, pd.DataFrame) or "Id" not in mapping_df.columns:

            issues.append(
                ValidationIssue(
                    "lookup_id_column_missing",
                    id_col,
                    len(df),
                    ERROR,
                    f"Lookup table '{table}' must be a DataFrame containing an 'Id' column",
                )
            )
            continue

        # Invalid (non-INT) IDs are reported once, by check_sql_types.
        ids, _ = parse_sql_integer(
            df[id_col],
            "INT"
        )

        known = set()

        for value in mapping_df["Id"].dropna():

            try:
                known.add(int(value))
            except (TypeError, ValueError, OverflowError):
                continue

        missing = (
            ids.notna() & ~ids.isin(known)
        ).fillna(False)

        if missing.any():

            issues.append(
                _issue(
                    "foreign_key_missing",
                    id_col,
                    missing,
                    ERROR,
                    f"IDs not in {table}: "
                    f"{sorted(ids[missing].dropna().unique().tolist())[:10]}",
                    df,
                )
            )

    return issues


def check_row_preservation(
    df: pd.DataFrame,
    raw_df: pd.DataFrame | None = None,
    expected_rows: int | None = None
) -> list[ValidationIssue]:

    issues = []

    if expected_rows is not None and len(df) != expected_rows:

        issues.append(
            ValidationIssue(
                "row_count_changed",
                None,
                abs(len(df) - expected_rows),
                ERROR,
                f"Expected {expected_rows:,} rows, found {len(df):,}",
            )
        )

    if raw_df is None:
        return issues

    if not _has(raw_df, "encounter_id", "patient_nbr"):

        issues.append(
            ValidationIssue(
                "raw_columns_missing",
                None,
                0,
                ERROR,
                "Raw dataframe must contain encounter_id and patient_nbr "
                "for row-preservation checks",
            )
        )
        return issues

    if not _has(df, "ExternalAdmissionId", "ExternalPatientId"):
        return issues

    if len(raw_df) != len(df):

        issues.append(
            ValidationIssue(
                "row_count_changed",
                None,
                abs(len(raw_df) - len(df)),
                ERROR,
                f"Raw file has {len(raw_df):,} rows; "
                f"cleaned data has {len(df):,}",
            )
        )

    raw_ids = set(raw_df["encounter_id"].astype(str))
    clean_ids = set(df["ExternalAdmissionId"].astype(str))

    if raw_ids != clean_ids:

        issues.append(
            ValidationIssue(
                "admission_ids_changed",
                "ExternalAdmissionId",
                len(raw_ids ^ clean_ids),
                ERROR,
                f"{len(raw_ids - clean_ids)} missing, "
                f"{len(clean_ids - raw_ids)} added",
            )
        )

    raw_patients = raw_df["patient_nbr"].astype(str).nunique()
    clean_patients = df["ExternalPatientId"].astype(str).nunique()

    if raw_patients != clean_patients:

        issues.append(
            ValidationIssue(
                "patient_count_changed",
                "ExternalPatientId",
                abs(raw_patients - clean_patients),
                ERROR,
                f"Raw: {raw_patients:,} patients; "
                f"cleaned: {clean_patients:,}",
            )
        )

    if (
        not raw_df["encounter_id"].duplicated().any()
        and not df["ExternalAdmissionId"].duplicated().any()
        and raw_ids == clean_ids
    ):

        link = (
            raw_df.set_index(
                raw_df["encounter_id"].astype(str)
            )["patient_nbr"].astype(str)
        )

        moved = (
            df["ExternalPatientId"].astype(str).values
            != link.loc[
                df["ExternalAdmissionId"].astype(str)
            ].values
        )

        if moved.any():

            issues.append(
                _issue(
                    "patient_link_changed",
                    "ExternalPatientId",
                    pd.Series(moved, index=df.index),
                    ERROR,
                    "Admission now points to a different patient",
                    df,
                )
            )

    return issues


def check_original_values(
    df: pd.DataFrame,
    raw_df: pd.DataFrame | None
) -> list[ValidationIssue]:

    issues = []

    if raw_df is None:
        return issues

    if "encounter_id" not in raw_df.columns:

        return [
            ValidationIssue(
                "raw_column_missing",
                "encounter_id",
                len(raw_df),
                ERROR,
                "Cannot compare original values because encounter_id is missing",
            )
        ]

    if "ExternalAdmissionId" not in df.columns:
        return issues

    raw_columns_needed = (
        set(RAW_TO_CLEAN_NAMES.keys())
        | {"encounter_id"}
    )

    missing_raw = sorted(
        raw_columns_needed - set(raw_df.columns)
    )

    if missing_raw:

        return [
            ValidationIssue(
                "raw_columns_missing",
                None,
                len(raw_df),
                ERROR,
                f"Cannot verify original values. Missing raw columns: {missing_raw}",
            )
        ]

    if (
        raw_df["encounter_id"].duplicated().any()
        or df["ExternalAdmissionId"].duplicated().any()
    ):
        return issues

    raw = raw_df.rename(
        columns=RAW_TO_CLEAN_NAMES
    ).copy()

    raw_ids = raw["ExternalAdmissionId"].astype(str)
    clean_ids = df["ExternalAdmissionId"].astype(str)

    raw = raw.set_index(raw_ids)
    clean = df.set_index(clean_ids)

    common = clean.index.intersection(raw.index)

    raw = raw.loc[common]
    clean = clean.loc[common]

    def missing_marker(series):
        return series.mask(
            series == MISSING_MARKER,
            pd.NA
        )

    expectations = {
        "RaceAtAdmission": missing_marker(raw["RaceAtAdmission"]),
        "GenderAtAdmission": raw["GenderAtAdmission"],
        "AgeGroup": raw["AgeGroup"],
        "ReadmissionStatus": raw["ReadmissionStatus"],
        **{
            col: raw[col]
            for col in MEDICATION_SQL_COLUMNS
        },
        **{
            col: missing_marker(raw[col]).map(
                lambda value:
                    DIAGNOSIS_ZERO_PAD_CODES[value][0]
                    if isinstance(value, str)
                    and value in DIAGNOSIS_ZERO_PAD_CODES
                    else value
            )
            for col in DIAGNOSIS_COLUMNS
        },
    }

    for col, expected in expectations.items():

        if col not in clean.columns:
            continue

        actual = clean[col].astype("string")
        expected = expected.astype("string")

        changed = (
            (actual != expected)
            & ~(actual.isna() & expected.isna())
        ).fillna(True)

        if changed.any():

            issues.append(
                ValidationIssue(
                    "original_value_changed",
                    col,
                    int(changed.sum()),
                    ERROR,
                    "Differs from the raw file without an approved transformation",
                    changed[changed].index[:SAMPLE_SIZE].tolist(),
                )
            )

    return issues


def check_cleaning_findings(
    cleaning_result: CleaningResult | None
) -> list[ValidationIssue]:

    if (
        cleaning_result is None
        or cleaning_result.invalid_values is None
        or not len(cleaning_result.invalid_values)
    ):
        return []

    log = cleaning_result.invalid_values

    required_columns = {
        "Column",
        "OriginalValue",
        "ExternalAdmissionId",
    }

    if not required_columns.issubset(log.columns):

        return [
            ValidationIssue(
                "invalid_values_log_structure",
                None,
                len(log),
                ERROR,
                "Cleaning invalid_values log is missing required columns",
            )
        ]

    return [
        ValidationIssue(
            "invalid_source_value",
            col,
            len(group),
            ERROR,
            "Original source values could not be stored and were converted "
            f"to NULL during cleaning: "
            f"{group['OriginalValue'].astype(str).unique()[:5].tolist()}",
            group["ExternalAdmissionId"]
            .astype(str)
            .head(SAMPLE_SIZE)
            .tolist(),
        )
        for col, group in log.groupby("Column")
    ]


def check_date_logic(df: pd.DataFrame) -> list[ValidationIssue]:

    # The cleaned file has no date columns by design: the source contains no
    # dates, so COLUMN_SPEC has none and Admissions.AdmissionDate/DischargeDate
    # are loaded as NULL. This is expected, not a problem to review.
    if not _has(df, "AdmissionDate", "DischargeDate"):

        return [
            ValidationIssue(
                "no_dates_in_source",
                "AdmissionDate",
                len(df),
                INFO,
                "Source contains no admission/discharge dates. "
                "AdmissionDate and DischargeDate will be NULL; no dates were generated.",
            )
        ]

    admission = pd.to_datetime(
        df["AdmissionDate"],
        errors="coerce"
    )

    discharge = pd.to_datetime(
        df["DischargeDate"],
        errors="coerce"
    )

    # Both columns entirely NULL: source has no date information.
    if admission.isna().all() and discharge.isna().all():

        return [
            ValidationIssue(
                "no_dates_in_source",
                "AdmissionDate",
                len(df),
                INFO,
                "Source contains no admission/discharge dates. "
                "Both columns remain NULL; no dates were generated.",
            )
        ]

    # One date missing while the other exists.
    incomplete = (
        admission.isna() ^ discharge.isna()
    )

    issues = []

    if incomplete.any():

        issues.append(
            _issue(
                "incomplete_date_pair",
                "AdmissionDate",
                incomplete,
                WARNING,
                "Only one of AdmissionDate and DischargeDate is available",
                df,
            )
        )

    bad = (
        discharge < admission
    ).fillna(False)

    if bad.any():

        issues.append(
            _issue(
                "discharge_before_admission",
                "DischargeDate",
                bad,
                ERROR,
                "DischargeDate is earlier than AdmissionDate",
                df,
            )
        )

    return issues


def collect_informational(
    df: pd.DataFrame,
    cleaning_result: CleaningResult | None
) -> list[ValidationIssue]:

    infos = []

    required = {
        spec.name
        for spec in COLUMN_SPEC
        if spec.required
    }

    for col in CLEANED_COLUMNS:

        if col not in df.columns or col in required:
            continue

        nulls = int(df[col].isna().sum())

        if nulls:

            infos.append(
                ValidationIssue(
                    "missing_values",
                    col,
                    nulls,
                    INFO,
                    f"{nulls / max(len(df), 1):.2%} of rows are NULL",
                )
            )

    if _has(df, "ReadmissionStatus"):

        dist = df["ReadmissionStatus"].value_counts().to_dict()

        infos.append(
            ValidationIssue(
                "readmission_distribution",
                "ReadmissionStatus",
                len(df),
                INFO,
                ", ".join(
                    f"{key}={value:,}"
                    for key, value in dist.items()
                ),
            )
        )

    for col, meaning in (
        ("ExpiredAtDischarge", "exclude from model training and scoring"),
        ("DischargedToHospice", "review whether to include in model training"),
    ):

        if col in df.columns:

            n = int((df[col] == 1).sum())

            infos.append(
                ValidationIssue(
                    "flag_count",
                    col,
                    n,
                    INFO,
                    f"{n:,} admissions flagged; {meaning}",
                )
            )

    if _has(
        df,
        "PatientDemographicConflict",
        "ExternalPatientId"
    ):

        n = int(
            df.loc[
                df["PatientDemographicConflict"] == 1,
                "ExternalPatientId"
            ].nunique()
        )

        infos.append(
            ValidationIssue(
                "patients_with_demographic_conflict",
                "PatientDemographicConflict",
                n,
                INFO,
                f"{n} patients: patient-level race/gender left NULL; "
                "admission values preserved",
            )
        )

    constant = [
        col
        for col in CLEANED_COLUMNS
        if (
            col in df.columns
            and len(df)
            and df[col].nunique(dropna=False) == 1
        )
    ]

    if constant:

        infos.append(
            ValidationIssue(
                "zero_variance_columns",
                None,
                len(constant),
                INFO,
                f"Same value in every row: {constant}",
            )
        )

    if (
        cleaning_result is not None
        and cleaning_result.diagnosis_changes is not None
        and len(cleaning_result.diagnosis_changes)
    ):

        by_col = (
            cleaning_result.diagnosis_changes["Column"]
            .value_counts()
            .to_dict()
        )

        infos.append(
            ValidationIssue(
                "diagnosis_codes_zero_padded",
                None,
                len(cleaning_result.diagnosis_changes),
                INFO,
                f"Verified leading-zero restorations: {by_col}",
            )
        )

    return infos


# ============================================================
# 4. MAIN API
# ============================================================

def validate_cleaned_data(
    df: pd.DataFrame,
    id_mappings: dict[str, pd.DataFrame] | None = None,
    raw_df: pd.DataFrame | None = None,
    cleaning_result: CleaningResult | None = None,
    expected_rows: int | None = None,
) -> ValidationResult:

    """Run every validation check without modifying the input data."""

    checks: list[
        tuple[str, Callable[[], list[ValidationIssue]]]
    ] = [
        ("required_columns", lambda: check_required_columns(df)),
        ("unexpected_columns", lambda: check_unexpected_columns(df)),
        ("null_values", lambda: check_null_values(df, cleaning_result)),
        ("sql_types", lambda: check_sql_types(df)),
        ("nvarchar_lengths", lambda: check_nvarchar_lengths(df)),
        ("value_ranges", lambda: check_value_ranges(df)),
        ("discharge_flags", lambda: check_discharge_flags(df)),
        ("allowed_values", lambda: check_allowed_values(df)),
        ("diagnosis_codes", lambda: check_diagnosis_codes(df)),
        ("readmission_labels", lambda: check_readmission_labels(df)),
        ("medications", lambda: check_medications(df)),
        ("unique_admissions", lambda: check_unique_admissions(df, cleaning_result)),
        ("patient_consistency", lambda: check_patient_consistency(df)),
        ("foreign_keys", lambda: check_foreign_keys(df, id_mappings, cleaning_result)),
        ("row_preservation", lambda: check_row_preservation(df, raw_df, expected_rows)),
        ("original_values", lambda: check_original_values(df, raw_df)),
        ("cleaning_findings", lambda: check_cleaning_findings(cleaning_result)),
        ("date_logic", lambda: check_date_logic(df)),
    ]

    issues = []
    passed = []

    for name, run in checks:

        found = run()
        issues.extend(found)

        if not any(
            issue.severity in (ERROR, WARNING)
            for issue in found
        ):
            passed.append(name)

    issues.extend(
        collect_informational(df, cleaning_result)
    )

    return ValidationResult(
        is_valid=not any(
            issue.severity == ERROR
            for issue in issues
        ),
        issues=issues,
        passed=passed,
        checks_run=[name for name, _ in checks],
        total_rows=len(df),
    )


def has_critical_errors(
    result: ValidationResult | dict
) -> bool:

    """Return True when SQL loading must be blocked."""

    if isinstance(result, ValidationResult):
        return bool(result.errors)

    if isinstance(result, dict):

        return (
            bool(result.get("summary", {}).get("errors", 0))
            or not result.get("can_load", False)
        )

    raise TypeError(
        f"Expected ValidationResult or report dict, "
        f"got {type(result).__name__}"
    )


def generate_validation_report(
    result: ValidationResult,
    output_path: str | None = None
) -> dict:

    """Create a JSON-serialisable validation report."""

    report = {
        "generated_at": datetime.now(
            timezone.utc
        ).isoformat(timespec="seconds"),

        "status": (
            "PASSED"
            if result.is_valid
            else "FAILED"
        ),

        "can_load": result.is_valid,
        "total_rows": result.total_rows,

        "summary": {
            "errors": len(result.errors),
            "warnings": len(result.warnings),
            "info": len(result.infos),
            "checks_run": result.checks_run,
            "checks_passed": result.passed,
        },

        "errors": [
            asdict(issue)
            for issue in result.errors
        ],

        "warnings": [
            asdict(issue)
            for issue in result.warnings
        ],

        "info": [
            asdict(issue)
            for issue in result.infos
        ],
    }

    if output_path:

        path = Path(output_path)
        path.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        with open(
            path,
            "w",
            encoding="utf-8"
        ) as handle:

            json.dump(
                report,
                handle,
                indent=2,
                ensure_ascii=False
            )

    return report


def format_validation_report(report: dict) -> str:

    """Readable text version of the validation report."""

    summary = report["summary"]

    lines = [
        "=" * 72,

        f"VALIDATION {report['status']} "
        f"rows={report['total_rows']:,} "
        f"errors={summary['errors']} "
        f"warnings={summary['warnings']} "
        f"info={summary['info']} "
        f"can_load={report['can_load']}",

        "=" * 72,
    ]

    for title, key in (
        ("ERRORS (block loading)", "errors"),
        ("WARNINGS (review)", "warnings"),
        ("INFO", "info"),
    ):

        lines.append(
            f"{title}: {len(report[key])}"
        )

        for issue in report[key]:

            column = (
                f" [{issue['column']}]"
                if issue["column"]
                else ""
            )

            lines.append(
                f"  - {issue['rule']}{column}: "
                f"{issue['row_count']:,} - {issue['details']}"
            )

    lines.append(
        f"Checks passed "
        f"({len(summary['checks_passed'])}/"
        f"{len(summary['checks_run'])}): "
        + ", ".join(summary["checks_passed"])
    )

    lines.append("=" * 72)

    return "\n".join(lines)


# Backwards-compatible alias for the existing pipeline.

def validate(
    df: pd.DataFrame,
    id_mappings: dict[str, pd.DataFrame] | None = None,
    raw_df: pd.DataFrame | None = None,
    cleaning_result: CleaningResult | None = None,
) -> ValidationResult:

    return validate_cleaned_data(
        df,
        id_mappings,
        raw_df,
        cleaning_result,
    )
