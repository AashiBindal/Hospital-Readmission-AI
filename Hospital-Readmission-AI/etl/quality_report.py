"""Data quality report generation (feeds DataQualityLogs, the UI and the docs).

Owner: Member 4 (ETL + Database).

This module only SUMMARISES what cleaning.py and validation.py produced.
It never changes the data and never decides whether loading is allowed:
that decision comes from validation.has_critical_errors().

Files it writes (normally into dataset/processed/, which is git-ignored):
* quality_report.json          - metrics + cleaning summary + validation report
* diagnosis_code_changes.csv   - one row per diagnosis code changed by cleaning
* invalid_values.csv           - only if cleaning recorded unconvertible values
* unknown_lookup_ids.csv       - only if cleaning found IDs missing from IDS_mapping.csv
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from cleaning import (
    APPROVED_TRANSFORMATIONS,
    CLEANED_COLUMNS,
    MISSING_MARKER,
    CleaningResult,
)
from validation import (
    ValidationResult,
    generate_validation_report,
    has_critical_errors,
)

DIAGNOSIS_CHANGES_FILE = "diagnosis_code_changes.csv"
INVALID_VALUES_FILE = "invalid_values.csv"
UNKNOWN_IDS_FILE = "unknown_lookup_ids.csv"

# Column limits of dbo.DataQualityLogs (database/schema.sql)
_RULE_NAME_MAX = 100
_COLUMN_NAME_MAX = 100


def _count_dict(series: pd.Series) -> dict[str, int]:
    """value_counts() as a JSON-safe {str: int} dict, NULLs included as 'NULL'."""
    counts = series.astype("string").fillna("NULL").value_counts()
    return {str(k): int(v) for k, v in counts.items()}


# ============================================================
# 1. METRICS (scaffold signature kept)
# ============================================================

def compute_quality_metrics(raw_df: pd.DataFrame, clean_df: pd.DataFrame) -> dict:
    """Return numeric data-quality metrics comparing the raw file and the cleaned data.

    raw_df   - raw file as read by load_data.read_raw_file() (all text)
    clean_df - CleaningResult.data (or load_data.read_cleaned_file())
    Nothing is modified; all values are plain ints/floats/strings for JSON.
    """
    raw_rows, clean_rows = len(raw_df), len(clean_df)
    mapped = [c for c in CLEANED_COLUMNS if c in clean_df.columns]

    null_counts = {c: int(clean_df[c].isna().sum()) for c in mapped}
    completeness = {c: round(100 * (1 - n / clean_rows), 2) if clean_rows else 0.0
                    for c, n in null_counts.items()}

    metrics: dict = {
        "rows": {
            "raw": raw_rows,
            "cleaned": clean_rows,
            "difference": clean_rows - raw_rows,
        },
        "columns": {
            "raw": int(raw_df.shape[1]),
            "cleaned": int(clean_df.shape[1]),
            "mapped": len(mapped),
            "unexpected": [c for c in clean_df.columns if c not in CLEANED_COLUMNS],
        },
        "admissions": {
            "raw_unique": int(raw_df["encounter_id"].nunique()) if "encounter_id" in raw_df else None,
            "cleaned_unique": int(clean_df["ExternalAdmissionId"].nunique())
            if "ExternalAdmissionId" in clean_df else None,
        },
        "patients": {
            "raw_unique": int(raw_df["patient_nbr"].nunique()) if "patient_nbr" in raw_df else None,
            "cleaned_unique": int(clean_df["ExternalPatientId"].nunique())
            if "ExternalPatientId" in clean_df else None,
        },
        "raw_missing_marker_counts": {
            c: int((raw_df[c] == MISSING_MARKER).sum())
            for c in raw_df.columns if (raw_df[c] == MISSING_MARKER).any()
        },
        "null_counts": {c: n for c, n in null_counts.items() if n},
        "completeness_pct": completeness,
        "overall_completeness_pct": round(sum(completeness.values()) / len(completeness), 2)
        if completeness else 0.0,
    }

    if "ExternalPatientId" in clean_df:
        stays = clean_df["ExternalPatientId"].value_counts()
        metrics["patients"]["with_multiple_admissions"] = int((stays > 1).sum())
        metrics["patients"]["max_admissions_per_patient"] = int(stays.max()) if len(stays) else 0

    if "ReadmissionStatus" in clean_df:
        status = _count_dict(clean_df["ReadmissionStatus"])
        metrics["readmission_status"] = status
        metrics["readmission_status_pct"] = {
            k: round(100 * v / clean_rows, 2) for k, v in status.items()} if clean_rows else {}
    if "Readmitted30Days" in clean_df:
        positives = int((clean_df["Readmitted30Days"] == 1).sum())
        metrics["readmitted_30_days"] = {
            "positive": positives,
            "negative": int((clean_df["Readmitted30Days"] == 0).sum()),
            "positive_rate_pct": round(100 * positives / clean_rows, 2) if clean_rows else 0.0,
        }

    flags = {}
    for col in ("ExpiredAtDischarge", "DischargedToHospice"):
        if col in clean_df:
            flags[col] = int((clean_df[col] == 1).sum())
    if {"PatientDemographicConflict", "ExternalPatientId"} <= set(clean_df.columns):
        flags["PatientsWithDemographicConflict"] = int(
            clean_df.loc[clean_df["PatientDemographicConflict"] == 1, "ExternalPatientId"].nunique())
    metrics["flags"] = flags

    metrics["zero_variance_columns"] = [
        c for c in mapped if clean_rows and clean_df[c].nunique(dropna=False) == 1]
    return metrics


# ============================================================
# 2. REPORT (scaffold signature kept, cleaning_result optional)
# ============================================================

def summarize_cleaning(cleaning_result: CleaningResult) -> dict:
    """JSON-safe summary of what cleaning.clean_with_details() recorded."""
    changes = cleaning_result.diagnosis_changes
    return {
        "approved_transformations": list(APPROVED_TRANSFORMATIONS),
        "steps": cleaning_result.steps,
        "diagnosis_changes": {
            "total_values_changed": int(len(changes)),
            "by_column": _count_dict(changes["Column"]) if len(changes) else {},
            "by_code": ({f"{o}->{n}": int(c) for (o, n), c in
                         changes.groupby(["OriginalValue", "CleanedValue"]).size().items()}
                        if len(changes) else {}),
        },
        "invalid_values": int(len(cleaning_result.invalid_values)),
        "unknown_lookup_ids": int(len(cleaning_result.unknown_lookup_ids)),
        "unexpected_columns": list(cleaning_result.unexpected_columns),
        "exact_duplicate_rows": int(cleaning_result.exact_duplicate_rows),
        "duplicate_admission_id_rows": int(cleaning_result.duplicate_admission_ids),
    }


def build_quality_report(metrics: dict,
                         validation: ValidationResult,
                         cleaning_result: CleaningResult | None = None,
                         source_file: str | None = None) -> dict:
    """Combine metrics, the cleaning summary and the validation report into one dict.

    The validation section is exactly validation.generate_validation_report(),
    so ERROR / WARNING / INFO stay separate and are not re-computed here.
    """
    validation_report = generate_validation_report(validation)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_file": source_file,
        "status": validation_report["status"],
        "can_load": not has_critical_errors(validation),
        "metrics": metrics,
        "validation": validation_report,
    }
    if cleaning_result is not None:
        report["cleaning"] = summarize_cleaning(cleaning_result)
    return report


# ============================================================
# 3. FILES (scaffold save_report kept)
# ============================================================

def save_report(report: dict, output_path: str) -> None:
    """Write the report to disk as indented UTF-8 JSON."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False, default=str)


def save_diagnosis_changes(changes: pd.DataFrame, output_path: str) -> None:
    """Write the per-value diagnosis code change log as CSV (header only if empty)."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    changes.to_csv(output_path, index=False, encoding="utf-8", lineterminator="\n")


def save_cleaning_logs(cleaning_result: CleaningResult, output_dir: str) -> list[str]:
    """Write the cleaning logs that exist; return the paths written.

    diagnosis_code_changes.csv is always written; invalid_values.csv and
    unknown_lookup_ids.csv only when cleaning recorded something.
    """
    out = Path(output_dir)
    written = []
    path = out / DIAGNOSIS_CHANGES_FILE
    save_diagnosis_changes(cleaning_result.diagnosis_changes, str(path))
    written.append(str(path))
    for frame, name in ((cleaning_result.invalid_values, INVALID_VALUES_FILE),
                        (cleaning_result.unknown_lookup_ids, UNKNOWN_IDS_FILE)):
        if len(frame):
            path = out / name
            frame.to_csv(path, index=False, encoding="utf-8", lineterminator="\n")
            written.append(str(path))
    return written


# ============================================================
# 4. DataQualityLogs ROWS
# ============================================================

def to_data_quality_log_rows(report: dict, upload_id: int) -> list[dict]:
    """Turn the report's validation issues into rows for dbo.DataQualityLogs.

    Columns: UploadId, RuleName, ColumnName, Severity, AffectedRows, Details.
    Severity is ERROR / WARNING / INFO, matching CK_DataQualityLogs_Severity.
    Example admission IDs are appended to Details.
    """
    rows = []
    validation_report = report["validation"]
    for key in ("errors", "warnings", "info"):
        for issue in validation_report[key]:
            details = issue["details"]
            if issue.get("sample_ids"):
                details += f" | example ExternalAdmissionIds: {', '.join(map(str, issue['sample_ids']))}"
            rows.append({
                "UploadId": int(upload_id),
                "RuleName": str(issue["rule"])[:_RULE_NAME_MAX],
                "ColumnName": str(issue["column"])[:_COLUMN_NAME_MAX] if issue["column"] else None,
                "Severity": issue["severity"],
                "AffectedRows": int(issue["row_count"]),
                "Details": details,
            })
    return rows


# ============================================================
# 5. CONSOLE SUMMARY
# ============================================================

def format_console_summary(report: dict) -> str:
    """Human-readable summary printed at the end of a pipeline run."""
    m = report["metrics"]
    v = report["validation"]
    s = v["summary"]
    lines = [
        "=" * 72,
        f"DATA QUALITY REPORT  status={report['status']}  can_load={report['can_load']}  "
        f"errors={s['errors']}  warnings={s['warnings']}  info={s['info']}",
        "=" * 72,
        f"Rows        : raw {m['rows']['raw']:,} -> cleaned {m['rows']['cleaned']:,} "
        f"(difference {m['rows']['difference']})",
        f"Admissions  : unique {m['admissions']['cleaned_unique']:,}",
        f"Patients    : raw {m['patients']['raw_unique']:,} -> cleaned {m['patients']['cleaned_unique']:,} "
        f"({m['patients'].get('with_multiple_admissions', 0):,} with more than one admission)",
        f"Columns     : raw {m['columns']['raw']} -> cleaned {m['columns']['cleaned']} "
        f"(mapped {m['columns']['mapped']}, unexpected {len(m['columns']['unexpected'])})",
        f"Completeness: {m['overall_completeness_pct']}% average across mapped columns",
    ]
    if "readmission_status" in m:
        lines.append(f"Readmission : {m['readmission_status']}  "
                     f"(<30 rate {m.get('readmitted_30_days', {}).get('positive_rate_pct', 'n/a')}%)")
    lines.append(f"Flags       : {m['flags']}")
    if "cleaning" in report:
        c = report["cleaning"]
        lines.append(f"Cleaning    : {c['diagnosis_changes']['total_values_changed']:,} diagnosis codes zero-padded, "
                     f"{c['invalid_values']} invalid values, {c['unknown_lookup_ids']} unknown IDs, "
                     f"{c['exact_duplicate_rows']} exact duplicate rows")
    for title, key in (("ERRORS (block loading)", "errors"), ("WARNINGS (review)", "warnings")):
        if v[key]:
            lines.append(f"{title}:")
            for issue in v[key]:
                column = f" [{issue['column']}]" if issue["column"] else ""
                lines.append(f"  - {issue['rule']}{column}: {issue['row_count']:,} - {issue['details']}")
    lines.append(f"Checks passed: {len(s['checks_passed'])}/{len(s['checks_run'])}")
    lines.append("=" * 72)
    return "\n".join(lines)
