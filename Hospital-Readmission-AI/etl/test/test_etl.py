"""Tests for the ETL (cleaning, validation, loading) and the SQL schema files.

Run from the etl/ folder:
    python -m unittest discover -s tests -v

No SQL Server is needed: loading is tested against FakeDatabase, an in-memory
stand-in that enforces identity keys, unique admission IDs, foreign keys and
transaction rollback. Test data is synthetic (no real patient rows).
If dataset/raw/diabetic_data.csv exists, one extra test cleans and validates
the full file.
"""
from __future__ import annotations

import copy
import re
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path

import pandas as pd

ETL_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ETL_DIR.parent
sys.path.insert(0, str(ETL_DIR))

import cleaning  # noqa: E402
import load_data  # noqa: E402
import validation  # noqa: E402

RAW_FILE = PROJECT_ROOT / "dataset" / "raw" / "diabetic_data.csv"
MAPPING_ROWS = {
    "AdmissionTypes": [(1, "Emergency"), (2, "Urgent"), (3, "Elective"), (4, "Newborn"),
                       (5, "Not Available"), (6, "NULL"), (7, "Trauma Center"), (8, "Not Mapped")],
    "DischargeDispositions": [(1, "Discharged to home"), (3, "Discharged/transferred to SNF"),
                              (11, "Expired"), (13, "Hospice / home"), (18, "NULL"), (25, "Not Mapped")],
    "AdmissionSources": [(1, "Physician Referral"), (7, "Emergency Room"), (9, "Not Available"), (17, "NULL")],
}


def make_mappings() -> dict[str, pd.DataFrame]:
    out = {}
    for table, rows in MAPPING_ROWS.items():
        frame = pd.DataFrame(rows, columns=["Id", "Description"])
        frame["Id"] = frame["Id"].astype("int64")
        frame["IsPlaceholder"] = frame["Description"].isin(load_data.PLACEHOLDER_DESCRIPTIONS).astype(bool)
        out[table] = frame
    return out


def make_raw(rows: int = 12) -> pd.DataFrame:
    """Synthetic raw rows in the exact diabetic_data.csv format (all text)."""
    base = {c: "No" for c in cleaning.MEDICATION_COLUMNS}
    base.update({
        "race": "Caucasian", "gender": "Female", "age": "[60-70)", "weight": "?",
        "admission_type_id": "1", "discharge_disposition_id": "1", "admission_source_id": "7",
        "time_in_hospital": "3", "payer_code": "MC", "medical_specialty": "?",
        "num_lab_procedures": "40", "num_procedures": "1", "num_medications": "12",
        "number_outpatient": "0", "number_emergency": "0", "number_inpatient": "1",
        "diag_1": "428", "diag_2": "250.01", "diag_3": "V45", "number_diagnoses": "7",
        "max_glu_serum": "None", "A1Cresult": ">8", "change": "No", "diabetesMed": "No",
        "readmitted": "NO",
    })
    records = []
    for i in range(rows):
        r = dict(base, encounter_id=str(1000 + i), patient_nbr=str(500 + i // 2))   # 2 stays per patient
        records.append(r)
    records[0].update(diag_1="38", readmitted="<30", insulin="Up", change="Ch", diabetesMed="Yes")
    records[1].update(race="?", readmitted=">30", discharge_disposition_id="11")      # expired
    records[2].update(gender="Unknown/Invalid", discharge_disposition_id="13")          # hospice
    records[4].update(race="AfricanAmerican")                                           # patient 502 conflict
    records[5].update(race="Caucasian", diag_2="8", admission_type_id="6")              # placeholder type
    raw = pd.DataFrame(records)
    return raw[cleaning.RAW_COLUMNS]


# ============================================================
# Fake database
# ============================================================

class FakeDatabase:
    """In-memory database with the behaviour the loader relies on."""

    def __init__(self):
        self.state = {"tables": {t: [] for t in load_data.REQUIRED_TABLES}, "identity": {}}
        self.batches: list[tuple[str, int]] = []
        self.fail_on_table: str | None = None      # simulate a driver error
        self.drop_last_admission = False           # simulate a lost admission row
        self.drop_last_medication = False          # simulate a lost medication row

    @contextmanager
    def session(self):
        snapshot = copy.deepcopy(self.state)
        try:
            yield FakeGateway(self)
        except Exception:
            self.state = snapshot                  # ROLLBACK
            raise

    def rows(self, table):
        return self.state["tables"][table]

    def next_id(self, table):
        self.state["identity"][table] = self.state["identity"].get(table, 0) + 1
        return self.state["identity"][table]


class FakeGateway:
    batch_size = 4

    def __init__(self, fake: FakeDatabase):
        self.fake = fake

    def missing_tables(self, tables):
        return [t for t in tables if t not in self.fake.state["tables"]]

    def missing_columns(self, table, columns):
        return []

    def read_lookup(self, table, id_column):
        return {r[id_column]: (r["Description"], r["IsPlaceholder"]) for r in self.fake.rows(table)}

    def insert_rows(self, table, columns, rows):
        if self.fake.fail_on_table == table:
            raise RuntimeError(f"simulated driver error while inserting into {table}")
        rows = list(rows)
        if table == "Admissions" and self.fake.drop_last_admission and rows:
            rows = rows[:-1]
        if table == "AdmissionMedications" and self.fake.drop_last_medication and rows:
            rows = rows[:-1]                       # the driver "reports" success but a row is missing
        target = self.fake.rows(table)
        for start in range(0, len(rows), self.batch_size):
            batch = rows[start:start + self.batch_size]
            self.fake.batches.append((table, len(batch)))
            for values in batch:
                record = dict(zip(columns, values))
                if table == "Admissions":
                    if any(a["ExternalAdmissionId"] == record["ExternalAdmissionId"] for a in target):
                        raise RuntimeError("UX_Admissions_ExternalAdmissionId violated")
                    if not any(p["PatientId"] == record["PatientId"] for p in self.fake.rows("Patients")):
                        raise RuntimeError("FK_Admissions_Patients violated")
                    record["AdmissionId"] = self.fake.next_id(table)
                if table == "Patients":
                    record["PatientId"] = self.fake.next_id(table)
                if table == "AdmissionMedications" and not any(
                        a["AdmissionId"] == record["AdmissionId"] for a in self.fake.rows("Admissions")):
                    raise RuntimeError("FK_AdmissionMedications_Admissions violated")
                target.append(record)
        return len(list(rows))

    def read_patients(self):
        return {p["ExternalPatientId"]: (p["PatientId"], p["Race"], p["Gender"], p["HasDemographicConflict"])
                for p in self.fake.rows("Patients")}

    def read_existing_admission_ids(self):
        return {a["ExternalAdmissionId"] for a in self.fake.rows("Admissions")}

    def read_admission_ids(self, upload_id):
        return {a["ExternalAdmissionId"]: a["AdmissionId"] for a in self.fake.rows("Admissions")
                if a["UploadId"] == upload_id}

    def create_upload(self, file_name, file_size, total_rows):
        uid = self.fake.next_id("Uploads")
        self.fake.rows("Uploads").append({"UploadId": uid, "FileName": file_name, "Status": "PROCESSING"})
        return uid

    def _upload(self, upload_id):
        return next(u for u in self.fake.rows("Uploads") if u["UploadId"] == upload_id)

    def upload_exists(self, upload_id):
        return any(u["UploadId"] == upload_id for u in self.fake.rows("Uploads"))

    def start_existing_upload(self, upload_id, total_rows):
        self._upload(upload_id)["Status"] = "PROCESSING"

    def complete_upload(self, upload_id, total_rows, valid_rows, rejected_rows):
        self._upload(upload_id).update(Status="COMPLETED", ValidRows=valid_rows)

    def mark_upload_failed(self, upload_id, message):
        self._upload(upload_id).update(Status="FAILED", ErrorMessage=message)

    def record_failed_upload(self, file_name, file_size, total_rows, message):
        uid = self.fake.next_id("Uploads")
        self.fake.rows("Uploads").append({"UploadId": uid, "Status": "FAILED", "ErrorMessage": message})
        return uid

    def upload_status(self, upload_id):
        return self._upload(upload_id)["Status"]

    def upload_counts(self, upload_id):
        adm = [a for a in self.fake.rows("Admissions") if a["UploadId"] == upload_id]
        ids = {a["AdmissionId"] for a in adm}
        meds = [m for m in self.fake.rows("AdmissionMedications") if m["AdmissionId"] in ids]
        return {"admissions": len(adm), "medications": len(meds),
                "admissions_without_medications": len(ids - {m["AdmissionId"] for m in meds}),
                "distinct_patients": len({a["PatientId"] for a in adm}),
                "quality_logs": sum(1 for q in self.fake.rows("DataQualityLogs") if q["UploadId"] == upload_id)}


# ============================================================
# Tests
# ============================================================

class CleaningAndValidationTests(unittest.TestCase):
    def setUp(self):
        self.raw, self.maps = make_raw(), make_mappings()
        self.result = cleaning.clean_with_details(self.raw, self.maps)

    def test_no_rows_or_patients_lost(self):
        self.assertEqual(len(self.result.data), len(self.raw))
        self.assertEqual(self.result.data["ExternalPatientId"].nunique(), self.raw["patient_nbr"].nunique())
        self.assertEqual(list(self.result.data.columns), cleaning.CLEANED_COLUMNS)

    def test_approved_transformations(self):
        d = self.result.data.set_index("ExternalAdmissionId")
        self.assertEqual(d.loc["1000", "PrimaryDiagnosisCode"], "038")       # verified zero-padding
        self.assertEqual(d.loc["1005", "SecondaryDiagnosisCode"], "008")
        self.assertEqual(d.loc["1000", "SecondaryDiagnosisCode"], "250.01")  # untouched
        self.assertTrue(pd.isna(d.loc["1001", "RaceAtAdmission"]))           # '?' -> NULL
        self.assertEqual(d.loc["1002", "GenderAtAdmission"], "Unknown/Invalid")
        self.assertEqual(d.loc["1000", "MaxGluSerum"], "NotTested")
        self.assertEqual(d.loc["1000", "ReadmissionStatus"], "<30")
        self.assertEqual(d.loc["1000", "Readmitted30Days"], 1)
        self.assertEqual(d.loc["1001", "ExpiredAtDischarge"], 1)
        self.assertEqual(d.loc["1002", "DischargedToHospice"], 1)
        self.assertTrue(pd.isna(d.loc["1005", "AdmissionType"]))             # placeholder -> NULL, ID kept
        self.assertEqual(d.loc["1005", "AdmissionTypeId"], 6)
        self.assertEqual(len(self.result.diagnosis_changes), 2)

    def test_patient_demographic_conflict(self):
        d = self.result.data.set_index("ExternalAdmissionId")
        self.assertEqual(d.loc["1004", "PatientDemographicConflict"], 1)
        self.assertTrue(pd.isna(d.loc["1004", "PatientRace"]))
        self.assertEqual(d.loc["1004", "RaceAtAdmission"], "AfricanAmerican")  # admission value kept

    def test_validation_passes_and_never_modifies(self):
        before = self.result.data.copy(deep=True)
        r = validation.validate_cleaned_data(self.result.data, self.maps, self.raw, self.result, len(self.raw))
        self.assertTrue(r.is_valid, [i for i in r.errors])
        self.assertFalse(validation.has_critical_errors(r))
        self.assertTrue(self.result.data.equals(before))

    def test_validation_blocks_bad_data(self):
        bad = self.result.data.copy()
        bad.loc[0, "ReadmissionStatus"] = "YES"
        r = validation.validate_cleaned_data(bad, self.maps)
        self.assertTrue(validation.has_critical_errors(r))


class LoaderTests(unittest.TestCase):
    def setUp(self):
        self.raw, self.maps = make_raw(), make_mappings()
        self.df = cleaning.clean_with_details(self.raw, self.maps).data
        self.fake = FakeDatabase()

    def load(self, **kwargs):
        return load_data.load_cleaned_dataset(self.df, self.maps, "test.csv", 123,
                                              quality_log_rows=lambda uid: [], session_factory=self.fake.session,
                                              **kwargs)

    def test_full_load_and_verification(self):
        s = self.load()
        self.assertEqual(s["status"], "LOADED")
        self.assertEqual(s["admissions_inserted"], 12)
        self.assertEqual(s["patients_inserted"], 6)
        self.assertEqual(s["medications_inserted"], 12)
        self.assertEqual(s["lookup_rows_inserted"], {"AdmissionTypes": 8, "DischargeDispositions": 6,
                                                     "AdmissionSources": 4})
        self.assertTrue(s["verification"]["passed"])
        self.assertTrue(all(a["AdmissionId"] for a in self.fake.rows("Admissions")))
        self.assertTrue(all(n <= FakeGateway.batch_size for _, n in self.fake.batches))   # batched

    def test_admissions_link_to_correct_patients(self):
        self.load()
        pid = {p["PatientId"]: p["ExternalPatientId"] for p in self.fake.rows("Patients")}
        loaded = {a["ExternalAdmissionId"]: pid[a["PatientId"]] for a in self.fake.rows("Admissions")}
        expected = dict(zip(self.df["ExternalAdmissionId"], self.df["ExternalPatientId"]))
        self.assertEqual(loaded, expected)

    def test_rerun_skips_and_counts_existing(self):
        self.load()
        s = self.load()
        self.assertEqual(s["admissions_inserted"], 0)
        self.assertEqual(s["admissions_already_in_database"], 12)
        self.assertEqual(s["patients_already_in_database"], 6)
        self.assertEqual(len(self.fake.rows("Admissions")), 12)            # no duplicates
        notes = {q["RuleName"] for q in self.fake.rows("DataQualityLogs")}
        self.assertIn("admissions_already_loaded", notes)                   # never silent
        self.assertTrue(s["verification"]["passed"])

    def test_failure_rolls_back_and_records_failed_upload(self):
        self.fake.fail_on_table = "AdmissionMedications"
        with self.assertRaises(load_data.LoadError):
            self.load()
        self.assertEqual(self.fake.rows("Admissions"), [])                  # rolled back
        self.assertEqual(self.fake.rows("Patients"), [])
        self.assertEqual([u["Status"] for u in self.fake.rows("Uploads")], ["FAILED"])

    def test_lost_row_detected_and_rolled_back(self):
        self.fake.drop_last_admission = True
        with self.assertRaises(load_data.LoadError):
            self.load()
        self.assertEqual(self.fake.rows("Admissions"), [])

    def test_count_verification_catches_missing_rows(self):
        self.fake.drop_last_medication = True
        with self.assertRaises(load_data.LoadVerificationError):
            self.load()
        self.assertEqual(self.fake.rows("AdmissionMedications"), [])     # rolled back
        self.assertEqual(self.fake.rows("Uploads")[-1]["Status"], "FAILED")

    def test_lookup_conflict_stops_load(self):
        self.fake.rows("AdmissionTypes").append({"AdmissionTypeId": 1, "Description": "Something else",
                                                 "IsPlaceholder": False})
        with self.assertRaises(load_data.LookupConflictError):
            self.load()

    def test_rejects_unexpected_columns(self):
        with self.assertRaises(load_data.SchemaError):
            load_data.load_cleaned_dataset(self.df.assign(extra=1), self.maps, "t.csv",
                                           session_factory=self.fake.session)


class SchemaFileTests(unittest.TestCase):
    """database/*.sql must match cleaning.COLUMN_SPEC exactly."""

    @staticmethod
    def table_columns(sql: str, table: str) -> dict[str, tuple[str, bool]]:
        match = re.search(rf"CREATE TABLE dbo\.{table} \((.*?)\n\s*\)\s*;?\s*'?\)?\s*;?\s*\n", sql, re.S)
        if match is None:
            raise AssertionError(f"CREATE TABLE dbo.{table} not found")
        block = match.group(1)
        cols = {}
        for line in block.splitlines():
            m = re.match(r"\s*(\w+)\s+(BIGINT|INT|BIT|DATE|DATETIME2|DECIMAL\(\d+,\d+\)|NVARCHAR\((?:\d+|MAX)\))"
                         r"(?:\s+IDENTITY\(1,1\))?\s+(NOT NULL|NULL)", line)
            if m:
                cols[m.group(1)] = (m.group(2), m.group(3) == "NULL")
        return cols

    def check_against_spec(self, columns: dict[tuple[str, str], tuple[str, bool]], source: str):
        for spec in cleaning.COLUMN_SPEC:
            got = columns.get((spec.table, spec.db_column))
            self.assertIsNotNone(got, f"{source}: {spec.table}.{spec.db_column} missing")
            self.assertEqual(got, (spec.sql_type, spec.nullable), f"{source}: {spec.table}.{spec.db_column}")

    def check_in_lists(self, sql: str, source: str):
        q = "''" if "N''" in sql else "'"          # migration text is inside EXEC(N'...')
        item = rf"\s*N{q}[^']*{q}\s*,?"
        for spec in cleaning.COLUMN_SPEC:
            if not spec.db_check:
                continue
            m = re.search(rf"\b{spec.db_column}\s+IN \(((?:{item})+)\)", sql)
            self.assertIsNotNone(m, f"{source}: no CHECK for {spec.db_column}")
            values = set(re.findall(rf"N{q}([^']*){q}", m.group(1)))
            self.assertEqual(values, set(spec.allowed), f"{source}: CHECK list of {spec.db_column}")

    def test_schema_sql_matches_spec(self):
        sql = (PROJECT_ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
        self.assertNotRegex(sql, r"(?i)\bDROP\s+TABLE\b", "schema.sql must not drop tables")
        cols = {}
        for table in ("Patients", "Admissions", "AdmissionMedications"):
            cols.update({(table, c): v for c, v in self.table_columns(sql, table).items()})
        self.check_against_spec(cols, "schema.sql")
        self.check_in_lists(sql, "schema.sql")
        for table, id_col in load_data.LOOKUP_ID_COLUMNS.items():
            lookup = self.table_columns(sql, table)
            self.assertEqual(set(lookup), {id_col, "Description", "IsPlaceholder"})
        dql = self.table_columns(sql, "DataQualityLogs")
        self.assertTrue(set(load_data.DATA_QUALITY_LOG_COLUMNS) <= set(dql))

    def test_migration_matches_spec(self):
        sql = (PROJECT_ROOT / "database" / "migrations" / "001_diabetes_dataset_support.sql").read_text("utf-8")
        schema = (PROJECT_ROOT / "database" / "schema.sql").read_text(encoding="utf-8")
        self.assertNotRegex(sql, r"(?i)\bDROP\s+TABLE\b")
        cols = {}
        # Columns the old scaffold schema already had keep their original definition ...
        for table in ("Patients", "Admissions"):
            cols.update({(table, c): v for c, v in self.table_columns(schema, table).items()})
        # ... and the migration adds/alters the rest.
        for m in re.finditer(r"ALTER TABLE dbo\.(\w+) (?:ADD|ALTER COLUMN) (\w+) (\w+(?:\(\d+\))?) (NOT NULL|NULL)",
                             sql):
            cols[(m.group(1), m.group(2))] = (m.group(3), m.group(4) == "NULL")
        cols.update({("AdmissionMedications", c): v
                     for c, v in self.table_columns(sql, "AdmissionMedications").items()})
        self.check_against_spec(cols, "migration 001")
        self.check_in_lists(sql, "migration 001")


@unittest.skipUnless(RAW_FILE.is_file(), "dataset/raw/diabetic_data.csv not present")
class FullDatasetTest(unittest.TestCase):
    def test_full_file_cleans_and_validates(self):
        raw = load_data.read_raw_file(str(RAW_FILE))
        maps = load_data.read_id_mappings(str(RAW_FILE.with_name("IDS_mapping.csv")))
        result = cleaning.clean_with_details(raw, maps)
        r = validation.validate_cleaned_data(result.data, maps, raw, result, len(raw))
        self.assertEqual(len(result.data), len(raw))
        self.assertEqual(r.errors, [])


if __name__ == "__main__":
    unittest.main()
