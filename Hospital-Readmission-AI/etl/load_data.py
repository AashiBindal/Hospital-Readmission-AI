"""File reading and SQL Server loading.

Owner: Member 4 (ETL + Database).

Reading (no database needed)
----------------------------
read_raw_file()       raw diabetic_data.csv, every value read as TEXT
read_id_mappings()    splits IDS_mapping.csv into its three lookup tables
write_cleaned_file()  writes the cleaned CSV (empty cell = NULL)
read_cleaned_file()   reads it back with SQL-compatible types

Loading (database/schema.sql must be installed first)
-----------------------------------------------------
load_cleaned_dataset() loads everything in ONE transaction, in this order:
    1. schema check          - required tables/columns exist
    2. lookup tables         - rows from IDS_mapping.csv inserted if missing;
                               an existing row with a different description is an error
    3. Uploads               - one row, status PROCESSING
    4. Patients              - one row per ExternalPatientId; patients already in
                               the database are reused (never updated) and counted
    5. Admissions            - stays already in the database (same
                               ExternalAdmissionId) are skipped and counted, never silently
    6. AdmissionMedications  - one row per newly inserted admission
    7. DataQualityLogs       - every validation issue + load notes
    8. verification          - row counts re-queried; any mismatch rolls back
    9. Uploads               - status COMPLETED
After COMMIT the counts are verified again from the database.
If anything fails the transaction is rolled back and a FAILED upload is recorded.

Load only data that passed validation (validation.has_critical_errors() is False);
pipeline.py enforces this.
"""
from __future__ import annotations

import csv
import logging
from contextlib import AbstractContextManager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable

import pandas as pd

from cleaning import CLEANED_COLUMNS, COLUMN_SPEC, LOOKUP_TABLES

log = logging.getLogger("etl.load_data")

LOOKUP_TABLE_NAMES = {
    "admission_type_id": "AdmissionTypes",
    "discharge_disposition_id": "DischargeDispositions",
    "admission_source_id": "AdmissionSources",
}
# Lookup table -> its primary-key column in SQL Server
LOOKUP_ID_COLUMNS = {table: id_col for id_col, (_, table) in LOOKUP_TABLES.items()}
PLACEHOLDER_DESCRIPTIONS = {"NULL", "Not Mapped", "Unknown/Invalid", "Not Available"}

PATIENTS, ADMISSIONS, MEDICATIONS = "Patients", "Admissions", "AdmissionMedications"
REQUIRED_TABLES = [PATIENTS, ADMISSIONS, MEDICATIONS, "Uploads", "DataQualityLogs", *LOOKUP_ID_COLUMNS]
DATA_QUALITY_LOG_COLUMNS = ["UploadId", "RuleName", "ColumnName", "Severity", "AffectedRows", "Details"]


class LoadError(RuntimeError):
    """Loading stopped; the transaction was rolled back."""


class SchemaError(LoadError):
    """The database schema does not match the cleaned data."""


class LookupConflictError(LoadError):
    """A lookup row in the database differs from IDS_mapping.csv."""


class LoadVerificationError(LoadError):
    """Row counts after loading do not match what was sent."""


# ============================================================
# 1. FILE READING / WRITING
# ============================================================

def read_raw_file(path: str) -> pd.DataFrame:
    """Read a raw CSV/Excel file with EVERY value as text.

    keep_default_na=False is essential: otherwise pandas turns the word 'None'
    (lab test not performed) into NaN, and dtype=str stops '250.40' becoming 250.4.
    The raw file is only read, never modified.
    """
    p = Path(path)
    if p.suffix.lower() in (".xlsx", ".xls"):
        return pd.read_excel(p, dtype=str, keep_default_na=False)
    return pd.read_csv(p, dtype=str, keep_default_na=False, na_filter=False, encoding="utf-8")


def read_id_mappings(path: str) -> dict[str, pd.DataFrame]:
    """Split IDS_mapping.csv into three DataFrames: Id (int64), Description, IsPlaceholder (bool).

    The file contains three tables one after another, each starting with its own
    header row (e.g. 'admission_type_id,description') and separated by a ',' line.
    Descriptions are kept as in the source; only surrounding spaces are trimmed.
    """
    tables: dict[str, list[tuple[int, str]]] = {}
    current: str | None = None
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if not row or all(not cell.strip() for cell in row):
                current = None
                continue
            key = row[0].strip()
            if key in LOOKUP_TABLE_NAMES:
                current = LOOKUP_TABLE_NAMES[key]
                tables[current] = []
                continue
            if current is None:
                raise ValueError(f"Unexpected line outside a mapping table: {row}")
            if not key.lstrip("-").isdigit():
                raise ValueError(f"Non-integer ID {key!r} in section {current} of {path}")
            tables[current].append((int(key), row[1].strip() if len(row) > 1 else ""))
    result = {}
    for name in LOOKUP_TABLE_NAMES.values():
        if name not in tables:
            raise ValueError(f"{name} section not found in {path}")
        frame = pd.DataFrame(tables[name], columns=["Id", "Description"]).sort_values("Id").reset_index(drop=True)
        frame["Id"] = frame["Id"].astype("int64")
        frame["IsPlaceholder"] = frame["Description"].isin(PLACEHOLDER_DESCRIPTIONS).astype(bool)
        if frame["Id"].duplicated().any():
            raise ValueError(f"Duplicate IDs in {name}")
        result[name] = frame
    return result


def write_cleaned_file(df: pd.DataFrame, path: str) -> None:
    """Write the cleaned dataset as UTF-8 CSV. NULL is written as an empty cell."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False, na_rep="", encoding="utf-8", lineterminator="\n")


def read_cleaned_file(path: str) -> pd.DataFrame:
    """Read diabetic_data_cleaned.csv back with SQL-compatible types.

    Only empty cells are NULL, so text such as 'NotTested' is safe.
    """
    df = pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""], encoding="utf-8")
    for spec in COLUMN_SPEC:
        if spec.name in df.columns:
            if spec.sql_type in ("INT", "BIT"):
                df[spec.name] = pd.to_numeric(df[spec.name]).astype("Int64")
            else:
                df[spec.name] = df[spec.name].astype("string")
    return df


# ============================================================
# 2. CONNECTION (scaffold names kept, implemented in db.py)
# ============================================================

def build_connection_url() -> str:
    """SQLAlchemy URL built from config/.env (scaffold name kept)."""
    import db

    return db.build_connection_url()


def get_engine():
    """Cached SQLAlchemy engine (scaffold name kept)."""
    import db

    return db.get_engine()


def test_connection() -> bool:
    """True if the configured database answers (scaffold name kept)."""
    import db

    return bool(db.test_connection())


# ============================================================
# 3. ROW PREPARATION
# ============================================================

def _columns_for(table: str) -> dict[str, str]:
    """Cleaned CSV column -> database column, for one target table (from COLUMN_SPEC)."""
    return {c.name: c.db_column for c in COLUMN_SPEC if c.table == table}


def _python_value(value):
    """Convert pandas/numpy values to plain Python values pyodbc understands (NA -> None)."""
    if value is None or (not isinstance(value, (list, tuple, dict)) and pd.isna(value)):
        return None
    if hasattr(value, "item"):          # numpy scalar -> Python scalar
        return value.item()
    return value


def _rows(frame: pd.DataFrame) -> list[tuple]:
    return [tuple(_python_value(v) for v in row) for row in frame.itertuples(index=False, name=None)]


def _lookup_rows(frame: pd.DataFrame) -> list[tuple]:
    return [(int(r.Id), str(r.Description), bool(r.IsPlaceholder)) for r in frame.itertuples(index=False)]


# ============================================================
# 4. LOADING
# ============================================================

@dataclass
class LoadSummary:
    upload_id: int | None = None
    status: str = "NOT_STARTED"
    rows_in_file: int = 0
    lookup_rows_inserted: dict = field(default_factory=dict)
    patients_inserted: int = 0
    patients_already_in_database: int = 0
    patients_already_in_database_with_different_values: int = 0
    admissions_inserted: int = 0
    admissions_already_in_database: int = 0
    medications_inserted: int = 0
    quality_logs_inserted: int = 0
    verification: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return asdict(self)


def _default_session_factory(batch_size: int) -> Callable[[], AbstractContextManager]:
    import db

    return lambda: db.transaction(batch_size=batch_size)


def check_schema(gateway) -> None:
    """Raise SchemaError if a required table or column is missing in SQL Server."""
    missing_tables = gateway.missing_tables(REQUIRED_TABLES)
    if missing_tables:
        raise SchemaError(f"Missing tables {missing_tables}. Run database/schema.sql first "
                          f"(or database/migrations/001_diabetes_dataset_support.sql for an older database).")
    problems = {}
    for table in (PATIENTS, ADMISSIONS, MEDICATIONS):
        needed = list(_columns_for(table).values())
        if table == ADMISSIONS:
            needed += ["PatientId", "UploadId"]
        if table == MEDICATIONS:
            needed += ["AdmissionId"]
        missing = gateway.missing_columns(table, needed)
        if missing:
            problems[table] = missing
    if problems:
        raise SchemaError(f"Missing columns {problems}. Run database/migrations/001_diabetes_dataset_support.sql.")


def ensure_lookup_tables(gateway, id_mappings: dict[str, pd.DataFrame]) -> dict[str, int]:
    """Insert IDS_mapping.csv rows that are missing; never change existing rows.

    An existing row whose description or placeholder flag differs from the file
    raises LookupConflictError (a person must decide which is correct).
    """
    inserted = {}
    for table, id_column in LOOKUP_ID_COLUMNS.items():
        existing = gateway.read_lookup(table, id_column)
        wanted = _lookup_rows(id_mappings[table])
        conflicts = [(i, existing[i], (d, p)) for i, d, p in wanted if i in existing and existing[i] != (d, p)]
        if conflicts:
            raise LookupConflictError(f"{table}: database rows differ from IDS_mapping.csv: {conflicts[:5]}")
        new_rows = [r for r in wanted if r[0] not in existing]
        inserted[table] = gateway.insert_rows(table, [id_column, "Description", "IsPlaceholder"], new_rows)
    return inserted


def _load_notes(summary: LoadSummary, upload_id: int) -> list[dict]:
    """DataQualityLogs rows describing the load itself (nothing is skipped silently)."""
    notes = []
    if summary.admissions_already_in_database:
        notes.append({"UploadId": upload_id, "RuleName": "admissions_already_loaded", "ColumnName": "ExternalAdmissionId",
                      "Severity": "INFO", "AffectedRows": summary.admissions_already_in_database,
                      "Details": "Admissions with this ExternalAdmissionId were already in the database "
                                 "from an earlier upload; they were not inserted again."})
    if summary.patients_already_in_database:
        notes.append({"UploadId": upload_id, "RuleName": "patients_already_loaded", "ColumnName": "ExternalPatientId",
                      "Severity": "INFO", "AffectedRows": summary.patients_already_in_database,
                      "Details": "Existing Patients rows were reused and not modified."})
    if summary.patients_already_in_database_with_different_values:
        notes.append({"UploadId": upload_id, "RuleName": "existing_patient_values_differ", "ColumnName": "Race/Gender",
                      "Severity": "WARNING",
                      "AffectedRows": summary.patients_already_in_database_with_different_values,
                      "Details": "Existing Patients rows have different Race/Gender/HasDemographicConflict "
                                 "than this file derives; existing values were kept unchanged."})
    return notes


def load_cleaned_dataset(df: pd.DataFrame,
                         id_mappings: dict[str, pd.DataFrame],
                         file_name: str,
                         file_size: int | None = None,
                         quality_log_rows: Callable[[int], list[dict]] | list[dict] | None = None,
                         upload_id: int | None = None,
                         batch_size: int = 5000,
                         session_factory: Callable[[], AbstractContextManager] | None = None) -> dict:
    """Load validated cleaned data into SQL Server in one transaction (see module docstring).

    df               cleaned data with the 59 COLUMN_SPEC columns (and no others)
    id_mappings      load_data.read_id_mappings() output (lookup tables)
    quality_log_rows DataQualityLogs rows, or a function upload_id -> rows
                     (pipeline passes quality_report.to_data_quality_log_rows)
    upload_id        use an existing Uploads row instead of creating one
    session_factory  returns a transaction context manager yielding a gateway
                     (default: db.transaction; tests pass a fake)
    Returns LoadSummary.as_dict(). Raises LoadError (after rollback) on failure.
    """
    extra = [c for c in df.columns if c not in CLEANED_COLUMNS]
    missing = [c for c in CLEANED_COLUMNS if c not in df.columns]
    if missing or extra:
        raise SchemaError(f"Cleaned data does not match COLUMN_SPEC: missing={missing} unexpected={extra}")
    if df["ExternalAdmissionId"].duplicated().any():
        raise LoadError("Duplicate ExternalAdmissionId values; validation must pass before loading")

    session_factory = session_factory or _default_session_factory(batch_size)
    summary = LoadSummary(rows_in_file=len(df))
    pcols, acols, mcols = _columns_for(PATIENTS), _columns_for(ADMISSIONS), _columns_for(MEDICATIONS)

    try:
        with session_factory() as gw:
            check_schema(gw)
            summary.lookup_rows_inserted = ensure_lookup_tables(gw, id_mappings)

            # ---- Uploads ----
            if upload_id is None:
                upload_id = gw.create_upload(file_name, file_size, len(df))
            else:
                if not gw.upload_exists(upload_id):
                    raise LoadError(f"UploadId {upload_id} does not exist")
                gw.start_existing_upload(upload_id, len(df))
            summary.upload_id = upload_id

            # ---- Patients (one row per ExternalPatientId; existing rows reused, never updated) ----
            patients = df[list(pcols)].drop_duplicates("ExternalPatientId").rename(columns=pcols)
            existing_patients = gw.read_patients()
            is_new_patient = ~patients["ExternalPatientId"].isin(existing_patients.keys())
            reused = patients[~is_new_patient]
            summary.patients_already_in_database = int(len(reused))
            summary.patients_already_in_database_with_different_values = int(sum(
                existing_patients[r.ExternalPatientId][1:] != (
                    _python_value(r.Race), _python_value(r.Gender), int(r.HasDemographicConflict))
                for r in reused.itertuples(index=False)))
            summary.patients_inserted = gw.insert_rows(
                PATIENTS, list(patients.columns), _rows(patients[is_new_patient]))
            patient_ids = {ext: values[0] for ext, values in gw.read_patients().items()}

            # ---- Admissions (already-loaded stays are counted, not inserted again) ----
            already = gw.read_existing_admission_ids()
            is_new_admission = ~df["ExternalAdmissionId"].isin(already)
            summary.admissions_already_in_database = int((~is_new_admission).sum())
            new_df = df[is_new_admission.values]
            admissions = new_df[list(acols)].rename(columns=acols)
            admissions.insert(0, "PatientId", new_df["ExternalPatientId"].map(patient_ids))
            admissions.insert(1, "UploadId", upload_id)
            if admissions["PatientId"].isna().any():
                raise LoadError(f"{int(admissions['PatientId'].isna().sum())} admissions could not be "
                                f"linked to a PatientId")
            summary.admissions_inserted = gw.insert_rows(ADMISSIONS, list(admissions.columns), _rows(admissions))

            # ---- AdmissionMedications (1:1 with each newly inserted admission) ----
            admission_ids = gw.read_admission_ids(upload_id)
            meds = new_df[["ExternalAdmissionId", *mcols]].rename(columns=mcols)
            meds.insert(0, "AdmissionId", meds.pop("ExternalAdmissionId").map(admission_ids))
            if meds["AdmissionId"].isna().any():
                raise LoadError(f"{int(meds['AdmissionId'].isna().sum())} medication rows could not be "
                                f"linked to an AdmissionId")
            summary.medications_inserted = gw.insert_rows(MEDICATIONS, list(meds.columns), _rows(meds))

            # ---- DataQualityLogs ----
            rows = quality_log_rows(upload_id) if callable(quality_log_rows) else list(quality_log_rows or [])
            rows += _load_notes(summary, upload_id)
            summary.quality_logs_inserted = gw.insert_rows(
                "DataQualityLogs", DATA_QUALITY_LOG_COLUMNS,
                [tuple(r[c] for c in DATA_QUALITY_LOG_COLUMNS) for r in rows])

            # ---- Verification BEFORE commit (mismatch => rollback) ----
            counts = gw.upload_counts(upload_id)
            expected = {"admissions": summary.admissions_inserted, "medications": summary.admissions_inserted,
                        "admissions_without_medications": 0, "quality_logs": summary.quality_logs_inserted}
            wrong = {k: (counts[k], v) for k, v in expected.items() if counts[k] != v}
            if wrong:
                raise LoadVerificationError(f"Row counts do not match (found, expected): {wrong}")

            gw.complete_upload(upload_id, len(df), summary.admissions_inserted, 0)
        summary.status = "LOADED"
    except Exception as exc:
        summary.status = "FAILED"
        log.error("Load failed and was rolled back: %s", exc)
        _record_failure(session_factory, file_name, file_size, len(df), upload_id, str(exc))
        if isinstance(exc, LoadError):
            raise
        raise LoadError(f"Load failed and was rolled back: {exc}") from exc

    summary.verification = verify_loaded_data(df, summary.upload_id, session_factory)
    if not summary.verification["passed"]:
        raise LoadVerificationError(f"Post-commit verification failed: {summary.verification}")
    log.info("Load summary: %s", summary.as_dict())
    return summary.as_dict()


def _record_failure(session_factory, file_name, file_size, total_rows, upload_id, message) -> None:
    """Best effort: record the failure in its own transaction (the main one was rolled back)."""
    try:
        with session_factory() as gw:
            if upload_id is not None and gw.upload_exists(upload_id):
                gw.mark_upload_failed(upload_id, message)
            else:
                gw.record_failed_upload(file_name, file_size, total_rows, message)
    except Exception as inner:  # the database may be unreachable - never hide the original error
        log.warning("Could not record the failed upload: %s", inner)


def verify_loaded_data(df: pd.DataFrame, upload_id: int,
                       session_factory: Callable[[], AbstractContextManager] | None = None) -> dict:
    """Re-read the database after COMMIT and confirm every admission and patient is stored.

    Checks: all ExternalAdmissionIds and ExternalPatientIds of the file exist,
    this upload's admissions all have a medications row, and the upload is COMPLETED.
    """
    session_factory = session_factory or _default_session_factory(5000)
    with session_factory() as gw:
        stored_admissions = gw.read_existing_admission_ids()
        stored_patients = set(gw.read_patients().keys())
        counts = gw.upload_counts(upload_id)
        status = gw.upload_status(upload_id)
    file_admissions = set(df["ExternalAdmissionId"].astype(str))
    file_patients = set(df["ExternalPatientId"].astype(str))
    result = {
        "admissions_in_file": len(file_admissions),
        "admissions_found_in_database": len(file_admissions & stored_admissions),
        "patients_in_file": len(file_patients),
        "patients_found_in_database": len(file_patients & stored_patients),
        "upload_counts": counts,
        "upload_status": status,
    }
    result["passed"] = (result["admissions_found_in_database"] == result["admissions_in_file"]
                        and result["patients_found_in_database"] == result["patients_in_file"]
                        and counts["admissions_without_medications"] == 0
                        and counts["medications"] == counts["admissions"]
                        and status == "COMPLETED")
    return result


# ============================================================
# 5. SCAFFOLD COMPATIBILITY
# ============================================================

def load_dataframe(df: pd.DataFrame, table: str, if_exists: str = "append", connection=None) -> int:
    """Append a DataFrame to dbo.<table> in batches (scaffold name kept).

    `connection` may be a gateway from db.transaction(); otherwise a new
    transaction is opened. Only appends: never replaces or drops a table.
    """
    if if_exists != "append":
        raise ValueError("Only if_exists='append' is allowed (never replace/drop tables)")
    if df.empty:
        return 0
    if connection is not None:
        return connection.insert_rows(table, list(df.columns), _rows(df))
    import db

    with db.transaction() as gw:
        return gw.insert_rows(table, list(df.columns), _rows(df))


def log_quality_report(report: dict, upload_id: int) -> int:
    """Write the report's validation issues into dbo.DataQualityLogs (scaffold name kept).

    load_cleaned_dataset() already does this inside its transaction; use this
    only to attach a report to an existing upload separately.
    """
    import quality_report

    rows = quality_report.to_data_quality_log_rows(report, upload_id)
    frame = pd.DataFrame(rows, columns=DATA_QUALITY_LOG_COLUMNS)
    return load_dataframe(frame, "DataQualityLogs")
