
"""Data cleaning for the Diabetes 130-US Hospitals dataset.

Owner: Member 4 (ETL + Database).

No rows are deleted. Unexpected columns are preserved and reported.
Unsafe column-name collisions raise an error instead of overwriting data.
"""
from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Iterable

import pandas as pd

log = logging.getLogger("etl.cleaning")


# ============================================================
# 1. ALLOWED VALUES
# ============================================================

AGE_GROUPS = tuple(f"[{i}-{i + 10})" for i in range(0, 100, 10))
RACE_VALUES = ("Caucasian", "AfricanAmerican", "Hispanic", "Asian", "Other")
GENDER_AT_ADMISSION_VALUES = ("Female", "Male", "Unknown/Invalid")
PATIENT_GENDER_VALUES = ("Female", "Male")

WEIGHT_VALUES = (
    "[0-25)", "[25-50)", "[50-75)", "[75-100)", "[100-125)",
    "[125-150)", "[150-175)", "[175-200)", ">200"
)

PAYER_CODES = (
    "BC", "CH", "CM", "CP", "DM", "FR", "HM", "MC", "MD",
    "MP", "OG", "OT", "PO", "SI", "SP", "UN", "WC"
)

MAX_GLU_SERUM_VALUES = ("NotTested", "Norm", ">200", ">300")
A1C_RESULT_VALUES = ("NotTested", "Norm", ">7", ">8")
READMISSION_STATUS_VALUES = ("NO", ">30", "<30")
MEDICATION_VALUES = ("No", "Steady", "Up", "Down")
BIT_VALUES = (0, 1)


# ============================================================
# 2. COLUMN SPECIFICATION
# ============================================================

@dataclass(frozen=True)
class ColumnSpec:
    name: str
    sql_type: str
    nullable: bool
    required: bool
    table: str
    db_column: str
    source: str
    allowed: tuple | None = None
    db_check: bool = False


P, A, M = "Patients", "Admissions", "AdmissionMedications"

COLUMN_SPEC: list[ColumnSpec] = [
    # Keys
    ColumnSpec("ExternalAdmissionId", "NVARCHAR(50)", True, True, A,
               "ExternalAdmissionId", "encounter_id"),
    ColumnSpec("ExternalPatientId", "NVARCHAR(50)", False, True, P,
               "ExternalPatientId", "patient_nbr"),

    # Patient-level demographics
    ColumnSpec("PatientRace", "NVARCHAR(50)", True, False, P, "Race",
               "derived from race", RACE_VALUES),
    ColumnSpec("PatientGender", "NVARCHAR(20)", True, False, P, "Gender",
               "derived from gender", PATIENT_GENDER_VALUES),
    ColumnSpec("PatientDemographicConflict", "BIT", False, True, P,
               "HasDemographicConflict", "derived demographic conflict", BIT_VALUES),

    # Admission-level demographics
    ColumnSpec("AgeGroup", "NVARCHAR(10)", True, True, A, "AgeGroup",
               "age", AGE_GROUPS, True),
    ColumnSpec("RaceAtAdmission", "NVARCHAR(50)", True, False, A,
               "RaceAtAdmission", "race", RACE_VALUES, True),
    ColumnSpec("GenderAtAdmission", "NVARCHAR(20)", True, True, A,
               "GenderAtAdmission", "gender", GENDER_AT_ADMISSION_VALUES, True),
    ColumnSpec("WeightRange", "NVARCHAR(10)", True, False, A,
               "WeightRange", "weight", WEIGHT_VALUES),
    ColumnSpec("PayerCode", "NVARCHAR(10)", True, False, A,
               "PayerCode", "payer_code", PAYER_CODES),

    # Admission lookup fields
    ColumnSpec("AdmissionTypeId", "INT", True, True, A,
               "AdmissionTypeId", "admission_type_id"),
    ColumnSpec("AdmissionType", "NVARCHAR(50)", True, False, A,
               "AdmissionType", "IDS_mapping description"),
    ColumnSpec("DischargeDispositionId", "INT", True, True, A,
               "DischargeDispositionId", "discharge_disposition_id"),
    ColumnSpec("DischargeDisposition", "NVARCHAR(150)", True, False, A,
               "DischargeDisposition", "IDS_mapping description"),
    ColumnSpec("AdmissionSourceId", "INT", True, True, A,
               "AdmissionSourceId", "admission_source_id"),
    ColumnSpec("AdmissionSource", "NVARCHAR(100)", True, False, A,
               "AdmissionSource", "IDS_mapping description"),
    ColumnSpec("Department", "NVARCHAR(100)", True, False, A,
               "Department", "medical_specialty"),

    # Counts
    ColumnSpec("LengthOfStayDays", "INT", True, True, A,
               "LengthOfStayDays", "time_in_hospital"),
    ColumnSpec("NumLabTests", "INT", True, True, A,
               "NumLabTests", "num_lab_procedures"),
    ColumnSpec("NumProcedures", "INT", True, True, A,
               "NumProcedures", "num_procedures"),
    ColumnSpec("NumMedications", "INT", True, True, A,
               "NumMedications", "num_medications"),
    ColumnSpec("NumOutpatientVisits", "INT", True, True, A,
               "NumOutpatientVisits", "number_outpatient"),
    ColumnSpec("NumEmergencyVisits", "INT", True, True, A,
               "NumEmergencyVisits", "number_emergency"),
    ColumnSpec("NumPriorAdmissions", "INT", True, True, A,
               "NumPriorAdmissions", "number_inpatient"),
    ColumnSpec("NumDiagnoses", "INT", True, True, A,
               "NumDiagnoses", "number_diagnoses"),

    # Diagnosis codes
    ColumnSpec("PrimaryDiagnosisCode", "NVARCHAR(20)", True, False, A,
               "PrimaryDiagnosisCode", "diag_1"),
    ColumnSpec("SecondaryDiagnosisCode", "NVARCHAR(20)", True, False, A,
               "SecondaryDiagnosisCode", "diag_2"),
    ColumnSpec("TertiaryDiagnosisCode", "NVARCHAR(20)", True, False, A,
               "TertiaryDiagnosisCode", "diag_3"),

    # Lab results
    ColumnSpec("MaxGluSerum", "NVARCHAR(10)", True, True, A,
               "MaxGluSerum", "max_glu_serum", MAX_GLU_SERUM_VALUES, True),
    ColumnSpec("A1CResult", "NVARCHAR(10)", True, True, A,
               "A1CResult", "A1Cresult", A1C_RESULT_VALUES, True),

    # Readmission labels and flags
    ColumnSpec("ReadmissionStatus", "NVARCHAR(5)", True, True, A,
               "ReadmissionStatus", "readmitted", READMISSION_STATUS_VALUES, True),
    ColumnSpec("Readmitted30Days", "BIT", True, True, A,
               "Readmitted30Days", "derived from readmitted", BIT_VALUES),
    ColumnSpec("ExpiredAtDischarge", "BIT", False, True, A,
               "ExpiredAtDischarge", "derived from discharge disposition", BIT_VALUES),
    ColumnSpec("DischargedToHospice", "BIT", False, True, A,
               "DischargedToHospice", "derived from discharge disposition", BIT_VALUES),
]


# ============================================================
# 3. MEDICATION COLUMNS
# ============================================================

MEDICATION_COLUMNS = {
    "metformin": "Metformin",
    "repaglinide": "Repaglinide",
    "nateglinide": "Nateglinide",
    "chlorpropamide": "Chlorpropamide",
    "glimepiride": "Glimepiride",
    "acetohexamide": "Acetohexamide",
    "glipizide": "Glipizide",
    "glyburide": "Glyburide",
    "tolbutamide": "Tolbutamide",
    "pioglitazone": "Pioglitazone",
    "rosiglitazone": "Rosiglitazone",
    "acarbose": "Acarbose",
    "miglitol": "Miglitol",
    "troglitazone": "Troglitazone",
    "tolazamide": "Tolazamide",
    "examide": "Examide",
    "citoglipton": "Citoglipton",
    "insulin": "Insulin",
    "glyburide-metformin": "GlyburideMetformin",
    "glipizide-metformin": "GlipizideMetformin",
    "glimepiride-pioglitazone": "GlimepiridePioglitazone",
    "metformin-rosiglitazone": "MetforminRosiglitazone",
    "metformin-pioglitazone": "MetforminPioglitazone",
}

COLUMN_SPEC += [
    ColumnSpec(sql, "NVARCHAR(10)", False, True, M, sql,
               f"{raw} (unchanged)", MEDICATION_VALUES, True)
    for raw, sql in MEDICATION_COLUMNS.items()
]

COLUMN_SPEC += [
    ColumnSpec("MedicationChanged", "BIT", False, True, M,
               "MedicationChanged", "change: Ch -> 1, No -> 0", BIT_VALUES),
    ColumnSpec("DiabetesMedPrescribed", "BIT", False, True, M,
               "DiabetesMedPrescribed", "diabetesMed: Yes -> 1, No -> 0", BIT_VALUES),
]

CLEANED_COLUMNS = [c.name for c in COLUMN_SPEC]
SPEC_BY_NAME = {c.name: c for c in COLUMN_SPEC}


# ============================================================
# 4. RAW COLUMN MAPPING
# ============================================================

RAW_TO_CLEAN_NAMES = {
    "encounter_id": "ExternalAdmissionId",
    "patient_nbr": "ExternalPatientId",
    "race": "RaceAtAdmission",
    "gender": "GenderAtAdmission",
    "age": "AgeGroup",
    "weight": "WeightRange",
    "admission_type_id": "AdmissionTypeId",
    "discharge_disposition_id": "DischargeDispositionId",
    "admission_source_id": "AdmissionSourceId",
    "time_in_hospital": "LengthOfStayDays",
    "payer_code": "PayerCode",
    "medical_specialty": "Department",
    "num_lab_procedures": "NumLabTests",
    "num_procedures": "NumProcedures",
    "num_medications": "NumMedications",
    "number_outpatient": "NumOutpatientVisits",
    "number_emergency": "NumEmergencyVisits",
    "number_inpatient": "NumPriorAdmissions",
    "diag_1": "PrimaryDiagnosisCode",
    "diag_2": "SecondaryDiagnosisCode",
    "diag_3": "TertiaryDiagnosisCode",
    "number_diagnoses": "NumDiagnoses",
    "max_glu_serum": "MaxGluSerum",
    "A1Cresult": "A1CResult",
    "change": "MedicationChanged",
    "diabetesMed": "DiabetesMedPrescribed",
    "readmitted": "ReadmissionStatus",
    **MEDICATION_COLUMNS,
}

RAW_COLUMNS = list(RAW_TO_CLEAN_NAMES.keys())


# ============================================================
# 5. APPROVED TRANSFORMATIONS AND CONSTANTS
# ============================================================

MISSING_MARKER = "?"
EXPIRED_DISPOSITION_IDS = (11, 19, 20, 21)
HOSPICE_DISPOSITION_IDS = (13, 14)
UNKNOWN_GENDER = "Unknown/Invalid"

LAB_NOT_TESTED_SOURCE = "None"
LAB_NOT_TESTED_CLEAN = "NotTested"

MEDICATION_CHANGED_MAP = {"Ch": "1", "No": "0"}
DIABETES_MED_MAP = {"Yes": "1", "No": "0"}

DIAGNOSIS_COLUMNS = [
    "PrimaryDiagnosisCode",
    "SecondaryDiagnosisCode",
    "TertiaryDiagnosisCode",
]

LOOKUP_TABLES = {
    "AdmissionTypeId": ("AdmissionType", "AdmissionTypes"),
    "DischargeDispositionId": ("DischargeDisposition", "DischargeDispositions"),
    "AdmissionSourceId": ("AdmissionSource", "AdmissionSources"),
}

APPROVED_TRANSFORMATIONS = [
    "Rename raw columns to SQL column names",
    "'?' and empty CSV cells -> NULL",
    "MaxGluSerum/A1CResult: None -> NotTested",
    "change: Ch -> 1, No -> 0",
    "diabetesMed: Yes -> 1, No -> 0",
    "Numeric text -> SQL INT/BIT after strict validation",
    "Add IDS_mapping descriptions; placeholder descriptions -> NULL",
    "Restore leading zeros only for verified diagnosis codes",
    "Derive readmission, expired and hospice flags",
    "Derive patient-level race, gender and conflict flag",
]


# Verified diagnosis code padding list.
DIAGNOSIS_ZERO_PAD_CODES = {
    "3": ("003", "Other salmonella infections"),
    "5": ("005", "Other food poisoning (bacterial)"),
    "7": ("007", "Other protozoal intestinal diseases"),
    "8": ("008", "Intestinal infections due to other organisms"),
    "9": ("009", "Ill-defined intestinal infections"),
    "10": ("010", "Primary tuberculous infection"),
    "11": ("011", "Pulmonary tuberculosis"),
    "14": ("014", "Tuberculosis of intestines, peritoneum, and mesenteric glands"),
    "17": ("017", "Tuberculosis of other organs"),
    "23": ("023", "Brucellosis"),
    "27": ("027", "Other zoonotic bacterial diseases"),
    "31": ("031", "Diseases due to other mycobacteria"),
    "34": ("034", "Streptococcal sore throat and scarlet fever"),
    "35": ("035", "Erysipelas"),
    "36": ("036", "Meningococcal infection"),
    "38": ("038", "Septicemia"),
    "39": ("039", "Actinomycotic infections"),
    "40": ("040", "Other bacterial diseases"),
    "41": ("041", "Bacterial infection in conditions classified elsewhere"),
    "42": ("042", "Human immunodeficiency virus [HIV] disease"),
    "46": ("046", "Slow virus infections and prion diseases"),
    "47": ("047", "Meningitis due to enterovirus"),
    "48": ("048", "Other enterovirus diseases of central nervous system"),
    "49": ("049", "Other non-arthropod-borne viral diseases of CNS"),
    "52": ("052", "Chickenpox"),
    "53": ("053", "Herpes zoster"),
    "54": ("054", "Herpes simplex"),
    "57": ("057", "Other viral exanthemata"),
    "58": ("058", "Other human herpesvirus"),
    "61": ("061", "Dengue"),
    "66": ("066", "Other arthropod-borne viral diseases"),
    "70": ("070", "Viral hepatitis"),
    "75": ("075", "Infectious mononucleosis"),
    "78": ("078", "Other diseases due to viruses and Chlamydiae"),
    "79": ("079", "Viral and chlamydial infection"),
    "82": ("082", "Tick-borne rickettsioses"),
    "84": ("084", "Malaria"),
    "88": ("088", "Other arthropod-borne diseases"),
    "94": ("094", "Neurosyphilis"),
    "96": ("096", "Late syphilis, latent"),
    "97": ("097", "Other and unspecified syphilis"),
    "98": ("098", "Gonococcal infections"),
    "99": ("099", "Other venereal diseases"),
}

ICD9_PATTERN = re.compile(
    r"^(\d{3}(\.\d{1,2})?|V\d{2}(\.\d{1,2})?|E\d{3}(\.\d{1,2})?)$"
)

INTEGER_TEXT = r"-?\d+"
SQL_INT_MIN = -2_147_483_648
SQL_INT_MAX = 2_147_483_647

CHANGE_LOG_COLUMNS = [
    "ExternalAdmissionId", "Column", "OriginalValue",
    "CleanedValue", "Rule", "CodeDescription"
]

INVALID_LOG_COLUMNS = [
    "ExternalAdmissionId", "Column", "OriginalValue", "Reason"
]


# ============================================================
# 6. RESULT STRUCTURE
# ============================================================

@dataclass
class CleaningResult:
    data: pd.DataFrame
    diagnosis_changes: pd.DataFrame
    invalid_values: pd.DataFrame
    unknown_lookup_ids: pd.DataFrame
    unexpected_columns: list[str] = field(default_factory=list)
    exact_duplicate_rows: int = 0
    duplicate_admission_ids: int = 0
    steps: list[dict] = field(default_factory=list)


def _log_step(steps, name, rows_affected, details):
    steps.append({
        "step": name,
        "rows_affected": int(rows_affected),
        "details": details,
    })
    log.info("%-30s rows_affected=%-7d %s",
             name, rows_affected, details)


def _is_text(series: pd.Series) -> bool:
    return (
        series.dtype == object
        or pd.api.types.is_string_dtype(series)
    )


# ============================================================
# 7. INPUT VALIDATION
# ============================================================

def check_raw_columns(df: pd.DataFrame):
    missing = [c for c in RAW_COLUMNS if c not in df.columns]
    unexpected = [c for c in df.columns if c not in RAW_TO_CLEAN_NAMES]
    return missing, unexpected


def validate_source_column_names(df: pd.DataFrame) -> None:
    """Reject duplicate names and collisions before renaming."""

    raw_columns = list(df.columns)

    # Duplicate names in the original DataFrame.
    duplicates = [
        name for name, count in Counter(raw_columns).items()
        if count > 1
    ]

    if duplicates:
        raise ValueError(
            "Duplicate raw column names found: "
            f"{duplicates}. Resolve these names before cleaning."
        )

    # Detect collisions after renaming.
    renamed = [
        RAW_TO_CLEAN_NAMES.get(name, name)
        for name in raw_columns
    ]

    renamed_duplicates = [
        name for name, count in Counter(renamed).items()
        if count > 1
    ]

    if renamed_duplicates:
        raise ValueError(
            "Column-name collision after renaming: "
            f"{renamed_duplicates}. Two source columns would map "
            "to the same output column."
        )

    # Generated columns must not already exist as unexpected source columns.
    generated_collisions = [
        name for name in raw_columns
        if name not in RAW_TO_CLEAN_NAMES
        and name in CLEANED_COLUMNS
    ]

    if generated_collisions:
        raise ValueError(
            "Unexpected source columns collide with generated SQL columns: "
            f"{generated_collisions}. Rename these source columns first."
        )


def check_id_mappings(id_mappings: dict[str, pd.DataFrame]) -> None:
    """Validate all three lookup DataFrames."""

    if not isinstance(id_mappings, dict):
        raise ValueError("id_mappings must be a dictionary of DataFrames.")

    problems = []

    for _, (_, table) in LOOKUP_TABLES.items():
        frame = id_mappings.get(table)

        if frame is None:
            problems.append(f"{table}: table is missing")
            continue

        if not isinstance(frame, pd.DataFrame):
            problems.append(f"{table}: expected a DataFrame")
            continue

        if frame.empty:
            problems.append(f"{table}: table is empty")
            continue

        missing = {"Id", "Description", "IsPlaceholder"} - set(frame.columns)

        if missing:
            problems.append(f"{table}: missing columns {sorted(missing)}")
            continue

        ids = frame["Id"]

        if (
            pd.api.types.is_bool_dtype(ids)
            or not pd.api.types.is_integer_dtype(ids)
        ):
            problems.append(
                f"{table}.Id must have integer dtype; got {ids.dtype}"
            )
        else:
            if ids.isna().any():
                problems.append(f"{table}.Id contains NULL values")

            if ids.duplicated().any():
                problems.append(f"{table}.Id contains duplicate values")

        flags = frame["IsPlaceholder"]

        if not pd.api.types.is_bool_dtype(flags):
            problems.append(
                f"{table}.IsPlaceholder must have boolean dtype; "
                f"got {flags.dtype}"
            )
        elif flags.isna().any():
            problems.append(f"{table}.IsPlaceholder contains NULL values")

        desc = frame["Description"]
        empty = desc.isna() | (desc.astype("string").str.strip() == "")

        if empty.any():
            problems.append(
                f"{table}.Description contains {int(empty.sum())} empty values"
            )

    if problems:
        raise ValueError(
            "Malformed IDS mappings:\n - " + "\n - ".join(problems)
        )


# ============================================================
# 8. CLEANING FUNCTIONS
# ============================================================

def standardize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Rename known columns while preserving unexpected columns."""

    validate_source_column_names(df)

    out = df.copy()

    unexpected = [
        c for c in out.columns
        if c not in RAW_TO_CLEAN_NAMES
    ]

    if unexpected:
        log.warning("Unexpected columns retained: %s", unexpected)

    return out.rename(columns=RAW_TO_CLEAN_NAMES)


def remove_duplicates(
    df: pd.DataFrame,
    subset: Iterable[str] | None = None
) -> pd.DataFrame:
    """Report duplicates but never delete rows."""

    exact = int(df.duplicated(keep=False).sum())

    if exact:
        log.warning(
            "%d rows participate in exact duplicates; all retained", exact
        )

    if subset:
        cols = [c for c in subset if c in df.columns]

        if cols:
            keyed = int(df.duplicated(subset=cols, keep=False).sum())

            if keyed:
                log.warning(
                    "%d rows share duplicate key columns %s; all retained",
                    keyed, cols
                )

    return df.copy()


def handle_missing_values(
    df: pd.DataFrame,
    strategy: dict[str, str] | None = None
) -> pd.DataFrame:
    """Convert '?' and empty text cells to pandas NULL values."""

    out = df.copy()

    for col in out.columns:
        if _is_text(out[col]):
            out[col] = out[col].mask(
                out[col].isin([MISSING_MARKER, ""]),
                pd.NA
            )

    if strategy:
        for col, value in strategy.items():
            if col in out.columns:
                out[col] = out[col].fillna(value)

    return out


def normalize_dates(
    df: pd.DataFrame,
    date_columns: Iterable[str]
) -> pd.DataFrame:
    """Parse explicitly supplied date columns. No dates are invented."""

    out = df.copy()

    for col in date_columns:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")

    return out


def normalize_categories(df: pd.DataFrame) -> pd.DataFrame:
    """Apply only approved category transformations."""

    out = df.copy()

    for col in ("MaxGluSerum", "A1CResult"):
        if col in out.columns:
            out[col] = out[col].mask(
                out[col] == LAB_NOT_TESTED_SOURCE,
                LAB_NOT_TESTED_CLEAN
            )

    for col, mapping in (
        ("MedicationChanged", MEDICATION_CHANGED_MAP),
        ("DiabetesMedPrescribed", DIABETES_MED_MAP),
    ):
        if col in out.columns:
            out[col] = out[col].map(
                lambda value, m=mapping:
                m.get(value, value) if pd.notna(value) else value
            )

    return out


def parse_sql_integer(
    values: pd.Series,
    sql_type: str
) -> tuple[pd.Series, pd.Series]:
    """Strictly parse INT/BIT values and return parsed values + invalid mask."""

    text = values.astype("string")
    present = text.notna()

    shape_ok = (
        text.str.fullmatch(INTEGER_TEXT)
        .fillna(False)
        .astype(bool)
    )

    number = pd.to_numeric(
        text.where(shape_ok),
        errors="coerce"
    )

    if sql_type == "BIT":
        in_range = number.isin(BIT_VALUES)
    elif sql_type == "INT":
        in_range = number.between(SQL_INT_MIN, SQL_INT_MAX)
    else:
        raise ValueError(f"Unsupported SQL integer type: {sql_type}")

    in_range = in_range.fillna(False).astype(bool)

    valid = present & shape_ok & in_range
    invalid = (present & ~valid).astype(bool)

    parsed = number.where(valid).astype("Int64")

    return parsed, invalid


def map_id_descriptions(
    df: pd.DataFrame,
    id_mappings: dict[str, pd.DataFrame]
) -> pd.DataFrame:
    """Add descriptions from IDS_mapping.csv without changing source IDs."""

    check_id_mappings(id_mappings)
    out = df.copy()

    for id_col, (text_col, table) in LOOKUP_TABLES.items():
        lookup = id_mappings[table]
        real = lookup[~lookup["IsPlaceholder"]]

        description_map = {
            int(identifier): description
            for identifier, description in zip(
                real["Id"], real["Description"]
            )
        }

        parsed, _ = parse_sql_integer(out[id_col], "INT")

        out[text_col] = parsed.map(
            lambda value, mapping=description_map:
            mapping.get(int(value), pd.NA)
            if pd.notna(value) else pd.NA
        )

    return out


def normalize_diagnosis_codes(
    df: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Restore leading zeros only for the approved diagnosis codes."""

    out = df.copy()
    changes = []

    for col in DIAGNOSIS_COLUMNS:
        if col not in out.columns:
            continue

        original = out[col]

        hit = (
            original.isin(DIAGNOSIS_ZERO_PAD_CODES.keys())
            .fillna(False)
            .astype(bool)
        )

        if hit.any():
            new_values = original[hit].map(
                lambda value: DIAGNOSIS_ZERO_PAD_CODES[value][0]
            )

            changes.append(pd.DataFrame({
                "ExternalAdmissionId": out.loc[
                    hit, "ExternalAdmissionId"
                ].values,
                "Column": col,
                "OriginalValue": original[hit].values,
                "CleanedValue": new_values.values,
                "Rule": "restore_leading_zeros_icd9_001_099",
                "CodeDescription": original[hit].map(
                    lambda value: DIAGNOSIS_ZERO_PAD_CODES[value][1]
                ).values,
            }))

            out.loc[hit, col] = new_values

    change_log = (
        pd.concat(changes, ignore_index=True)
        if changes
        else pd.DataFrame(columns=CHANGE_LOG_COLUMNS)
    )

    return out, change_log


def derive_labels_and_flags(df: pd.DataFrame) -> pd.DataFrame:
    """Derive readmission, expired and hospice flags."""

    out = df.copy()

    label_map = {
        "<30": 1,
        "NO": 0,
        ">30": 0,
    }

    out["Readmitted30Days"] = (
        out["ReadmissionStatus"]
        .map(
            lambda value:
            label_map.get(value, pd.NA)
            if pd.notna(value) else pd.NA
        )
        .astype("Int64")
    )

    disposition, _ = parse_sql_integer(
        out["DischargeDispositionId"], "INT"
    )

    out["ExpiredAtDischarge"] = (
        disposition.isin(EXPIRED_DISPOSITION_IDS)
        .fillna(False)
        .astype(int)
    )

    out["DischargedToHospice"] = (
        disposition.isin(HOSPICE_DISPOSITION_IDS)
        .fillna(False)
        .astype(int)
    )

    return out


def derive_patient_demographics(df: pd.DataFrame) -> pd.DataFrame:
    """Derive patient-level demographics without changing admission values."""

    out = df.copy()

    patient = out["ExternalPatientId"]
    race_known = out["RaceAtAdmission"]

    gender_known = out["GenderAtAdmission"].mask(
        out["GenderAtAdmission"] == UNKNOWN_GENDER,
        pd.NA
    )

    def consensus(values):
        grouped = values.groupby(patient)

        unique_count = grouped.nunique(dropna=True)
        first_value = grouped.first()

        agreed = first_value.where(unique_count == 1, pd.NA)
        conflict = unique_count > 1

        return agreed, conflict

    race, race_conflict = consensus(race_known)
    gender, gender_conflict = consensus(gender_known)

    per_patient = pd.DataFrame({
        "PatientRace": race,
        "PatientGender": gender,
        "PatientDemographicConflict": (
            race_conflict | gender_conflict
        ).astype(int),
    })

    return out.join(per_patient, on="ExternalPatientId")


# ============================================================
# 9. ERROR AND LOOKUP REPORTING
# ============================================================

def find_unconvertible_values(df: pd.DataFrame) -> pd.DataFrame:
    """Record invalid INT/BIT values before casting."""

    found = []

    for spec in COLUMN_SPEC:
        if spec.name not in df.columns:
            continue

        if spec.sql_type not in ("INT", "BIT"):
            continue

        _, invalid = parse_sql_integer(df[spec.name], spec.sql_type)

        if invalid.any():
            found.append(pd.DataFrame({
                "ExternalAdmissionId": df.loc[
                    invalid, "ExternalAdmissionId"
                ].astype("string").values,
                "Column": spec.name,
                "OriginalValue": df.loc[
                    invalid, spec.name
                ].astype("string").values,
                "Reason": f"not a valid {spec.sql_type} value",
            }))

    return (
        pd.concat(found, ignore_index=True)
        if found
        else pd.DataFrame(columns=INVALID_LOG_COLUMNS)
    )


def find_unknown_lookup_ids(
    df: pd.DataFrame,
    id_mappings: dict[str, pd.DataFrame]
) -> pd.DataFrame:
    """Record IDs that do not exist in IDS_mapping.csv."""

    found = []

    for id_col, (_, table) in LOOKUP_TABLES.items():
        parsed, _ = parse_sql_integer(df[id_col], "INT")

        known = set(
            int(value) for value in id_mappings[table]["Id"]
        )

        unknown = (
            parsed.notna() & ~parsed.isin(known)
        ).fillna(False).astype(bool)

        if unknown.any():
            found.append(pd.DataFrame({
                "ExternalAdmissionId": df.loc[
                    unknown, "ExternalAdmissionId"
                ].astype("string").values,
                "Column": id_col,
                "OriginalValue": df.loc[
                    unknown, id_col
                ].astype("string").values,
                "Reason": f"ID not found in {table}",
            }))

    return (
        pd.concat(found, ignore_index=True)
        if found
        else pd.DataFrame(columns=INVALID_LOG_COLUMNS)
    )


def cast_to_sql_types(df: pd.DataFrame) -> pd.DataFrame:
    """Convert mapped columns to pandas types compatible with SQL types."""

    out = df.copy()

    for spec in COLUMN_SPEC:
        if spec.name not in out.columns:
            continue

        if spec.sql_type in ("INT", "BIT"):
            out[spec.name], _ = parse_sql_integer(
                out[spec.name], spec.sql_type
            )
        else:
            out[spec.name] = out[spec.name].astype("string")

    return out


# ============================================================
# 10. MAIN CLEANING PIPELINE
# ============================================================

def clean_with_details(
    df: pd.DataFrame,
    id_mappings: dict[str, pd.DataFrame]
) -> CleaningResult:
    """Run cleaning and return the dataset plus all quality logs."""

    steps = []

    # First: protect the source columns from collisions.
    validate_source_column_names(df)

    missing, unexpected = check_raw_columns(df)

    if missing:
        raise ValueError(
            f"Raw file is missing expected columns: {missing}"
        )

    check_id_mappings(id_mappings)

    _log_step(
        steps,
        "check_raw_columns",
        0,
        f"all {len(RAW_COLUMNS)} expected columns present; "
        f"unexpected columns: {unexpected or 'none'}"
    )

    out = standardize_column_names(df)

    _log_step(
        steps,
        "standardize_column_names",
        0,
        f"{len(RAW_COLUMNS)} columns renamed; values untouched"
    )

    # Duplicates are reported, never deleted.
    exact_dups = int(out.duplicated(keep=False).sum())
    key_dups = int(
        out["ExternalAdmissionId"].duplicated(keep=False).sum()
    )

    out = remove_duplicates(
        out,
        subset=["ExternalAdmissionId"]
    )

    _log_step(
        steps,
        "remove_duplicates_report_only",
        0,
        f"rows kept={len(out)}; exact duplicate rows={exact_dups}; "
        f"duplicate admission IDs={key_dups}"
    )

    # Missing markers.
    missing_before = {
        col: int((out[col] == MISSING_MARKER).sum())
        for col in out.columns
        if _is_text(out[col])
    }

    out = handle_missing_values(out)

    _log_step(
        steps,
        "handle_missing_values",
        sum(missing_before.values()),
        "'?' -> NULL: " + (
            ", ".join(
                f"{col}={count}"
                for col, count in missing_before.items()
                if count
            ) or "none"
        )
    )

    # No dates exist in this dataset.
    out = normalize_dates(out, date_columns=[])

    _log_step(
        steps,
        "normalize_dates",
        0,
        "source has no date columns; no dates invented"
    )

    # Approved categorical transformations.
    lab_counts = {
        col: int((out[col] == LAB_NOT_TESTED_SOURCE).sum())
        for col in ("MaxGluSerum", "A1CResult")
    }

    out = normalize_categories(out)

    _log_step(
        steps,
        "normalize_categories",
        sum(lab_counts.values()),
        f"lab None -> NotTested: {lab_counts}; "
        "change/diabetesMed mapped to 1/0"
    )

    # Lookup descriptions.
    out = map_id_descriptions(out, id_mappings)

    _log_step(
        steps,
        "map_id_descriptions",
        len(out),
        "lookup descriptions added"
    )

    # Diagnosis code corrections.
    out, diagnosis_changes = normalize_diagnosis_codes(out)

    _log_step(
        steps,
        "normalize_diagnosis_codes",
        len(diagnosis_changes),
        "approved diagnosis code corrections recorded"
    )

    # Derived flags.
    out = derive_labels_and_flags(out)

    _log_step(
        steps,
        "derive_labels_and_flags",
        int(
            out["ExpiredAtDischarge"].sum()
            + out["DischargedToHospice"].sum()
        ),
        f"expired={int(out['ExpiredAtDischarge'].sum())}; "
        f"hospice={int(out['DischargedToHospice'].sum())}"
    )

    # Patient-level demographics.
    out = derive_patient_demographics(out)

    conflict_patients = int(
        out.loc[
            out["PatientDemographicConflict"] == 1,
            "ExternalPatientId"
        ].nunique()
    )

    _log_step(
        steps,
        "derive_patient_demographics",
        conflict_patients,
        f"patients with demographic conflicts={conflict_patients}"
    )

    # Unknown lookup IDs.
    unknown_ids = find_unknown_lookup_ids(out, id_mappings)

    _log_step(
        steps,
        "find_unknown_lookup_ids",
        len(unknown_ids),
        f"unknown lookup IDs found={len(unknown_ids)}"
    )

    # Record invalid values before casting.
    invalid = find_unconvertible_values(out)

    numeric_columns = [
        spec.name
        for spec in COLUMN_SPEC
        if spec.sql_type in ("INT", "BIT")
        and spec.name in out.columns
    ]

    present_before = {
        col: int(out[col].notna().sum())
        for col in numeric_columns
    }

    out = cast_to_sql_types(out)

    lost = {
        col: present_before[col] - int(out[col].notna().sum())
        for col in numeric_columns
    }

    recorded = (
        invalid["Column"].value_counts().to_dict()
        if len(invalid)
        else {}
    )

    if any(
        lost[col] != recorded.get(col, 0)
        for col in numeric_columns
    ):
        raise RuntimeError(
            "Casting removed values that were not recorded. "
            f"Lost={lost}; recorded={recorded}"
        )

    _log_step(
        steps,
        "cast_to_sql_types",
        len(invalid),
        f"invalid values recorded={len(invalid)}; "
        "unrecorded losses=0"
    )

    # Final output ordering. Unexpected columns remain at the end.
    out = out[CLEANED_COLUMNS + unexpected]

    _log_step(
        steps,
        "order_columns",
        0,
        f"{len(CLEANED_COLUMNS)} mapped columns + "
        f"{len(unexpected)} unexpected columns retained"
    )

    return CleaningResult(
        data=out,
        diagnosis_changes=diagnosis_changes,
        invalid_values=invalid,
        unknown_lookup_ids=unknown_ids,
        unexpected_columns=unexpected,
        exact_duplicate_rows=exact_dups,
        duplicate_admission_ids=key_dups,
        steps=steps,
    )


def clean(
    df: pd.DataFrame,
    id_mappings: dict[str, pd.DataFrame] | None = None
) -> pd.DataFrame:
    """Compatibility function returning only the cleaned DataFrame."""

    if id_mappings is None:
        raise ValueError(
            "id_mappings is required. Load it using "
            "load_data.read_id_mappings()."
        )

    return clean_with_details(df, id_mappings).data
