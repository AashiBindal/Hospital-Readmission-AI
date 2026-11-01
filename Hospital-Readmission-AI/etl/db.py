"""Reusable SQL Server connection module (SQLAlchemy + pyodbc).

Owner: Member 4 (ETL + Database).

* get_engine()          - one cached SQLAlchemy engine (fast_executemany on)
* test_connection()     - quick connectivity check
* transaction()         - context manager: ONE database transaction, yields a
                          SqlServerGateway; commits on success, rolls back on error
* SqlServerGateway      - every SQL statement the ETL sends lives here, so the
                          loading logic in load_data.py never builds SQL itself

Credentials come only from config.py (environment variables / .env).
SQLAlchemy and pyodbc are imported lazily, so cleaning and validation can run
on machines without the SQL Server driver.
"""
from __future__ import annotations

import logging
import re
from contextlib import contextmanager
from typing import Iterable, Iterator, Sequence
from urllib.parse import quote_plus

from config import DatabaseConfig, load_config

log = logging.getLogger("etl.db")

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_engine_cache: dict[tuple, object] = {}


# ============================================================
# 1. CONNECTION
# ============================================================

def build_odbc_connection_string(db: DatabaseConfig, mask_password: bool = False) -> str:
    """ODBC connection string for SQL Server (password masked on request)."""
    parts = [
        f"DRIVER={{{db.driver}}}",
        f"SERVER={db.server}",
        f"DATABASE={db.name}",
        f"Encrypt={'yes' if db.encrypt else 'no'}",
        f"TrustServerCertificate={'yes' if db.trust_server_certificate else 'no'}",
    ]
    if db.trusted_connection:
        parts.append("Trusted_Connection=yes")
    else:
        parts.append(f"UID={db.username}")
        parts.append(f"PWD={'********' if mask_password else db.password}")
    return ";".join(parts) + ";"


def build_connection_url(db: DatabaseConfig | None = None) -> str:
    """SQLAlchemy URL (kept for the scaffold's load_data.build_connection_url())."""
    db = db or load_config().database
    return "mssql+pyodbc:///?odbc_connect=" + quote_plus(build_odbc_connection_string(db))


def get_engine(db: DatabaseConfig | None = None):
    """Return a cached SQLAlchemy engine with pyodbc fast_executemany enabled."""
    from sqlalchemy import create_engine

    db = db or load_config().database
    db.validate()
    key = (db.server, db.name, db.username, db.trusted_connection, db.driver)
    if key not in _engine_cache:
        log.info("Connecting to SQL Server: %s", build_odbc_connection_string(db, mask_password=True))
        _engine_cache[key] = create_engine(build_connection_url(db), fast_executemany=True,
                                           pool_pre_ping=True)
    return _engine_cache[key]


def test_connection(db: DatabaseConfig | None = None) -> dict:
    """Run a tiny query; return server/database info or raise the driver error."""
    engine = get_engine(db)
    with engine.connect() as conn:
        row = conn.exec_driver_sql(
            "SELECT DB_NAME(), CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50)), "
            "CASE WHEN OBJECT_ID(N'dbo.Admissions', N'U') IS NULL THEN 0 ELSE 1 END").fetchone()
    return {"database": row[0], "server_version": row[1], "schema_installed": bool(row[2])}


@contextmanager
def transaction(db: DatabaseConfig | None = None, batch_size: int = 5000) -> Iterator["SqlServerGateway"]:
    """One database transaction. Commits if the block succeeds, otherwise rolls back."""
    engine = get_engine(db)
    with engine.begin() as conn:          # SQLAlchemy: COMMIT on success, ROLLBACK on exception
        yield SqlServerGateway(conn, batch_size)


# ============================================================
# 2. GATEWAY (all SQL used by the loader)
# ============================================================

def _ident(name: str) -> str:
    """Quote a table/column name after checking it is a plain identifier."""
    if not _IDENTIFIER.match(name):
        raise ValueError(f"Unsafe SQL identifier: {name!r}")
    return f"[{name}]"


class SqlServerGateway:
    """Database operations on one open SQLAlchemy connection (inside a transaction)."""

    def __init__(self, conn, batch_size: int = 5000):
        self.conn = conn
        self.batch_size = batch_size

    # ---------- generic ----------

    def insert_rows(self, table: str, columns: Sequence[str], rows: list[tuple]) -> int:
        """Insert rows in batches of `batch_size`; return the number of rows sent.

        Row counts are verified afterwards with SELECT COUNT queries, because
        pyodbc's fast_executemany does not report reliable per-batch row counts.
        """
        if not rows:
            return 0
        cols = ", ".join(_ident(c) for c in columns)
        marks = ", ".join("?" for _ in columns)
        sql = f"INSERT INTO dbo.{_ident(table)} ({cols}) VALUES ({marks})"
        sent = 0
        for start in range(0, len(rows), self.batch_size):
            batch = rows[start:start + self.batch_size]
            self.conn.exec_driver_sql(sql, batch)
            sent += len(batch)
            log.debug("%s: inserted batch %d-%d", table, start + 1, start + len(batch))
        log.info("%s: %d rows inserted in %d batch(es)", table, sent,
                 (len(rows) + self.batch_size - 1) // self.batch_size)
        return sent

    def _execute(self, sql: str, params: tuple = ()):
        return self.conn.exec_driver_sql(sql, params) if params else self.conn.exec_driver_sql(sql)

    def _fetch(self, sql: str, params: tuple = ()) -> list[tuple]:
        return [tuple(r) for r in self._execute(sql, params).fetchall()]

    def _scalar(self, sql: str, params: tuple = ()):
        return self._execute(sql, params).scalar()

    # ---------- schema ----------

    def missing_tables(self, tables: Iterable[str]) -> list[str]:
        return [t for t in tables
                if self._scalar("SELECT OBJECT_ID(?, N'U')", (f"dbo.{t}",)) is None]

    def missing_columns(self, table: str, columns: Iterable[str]) -> list[str]:
        existing = {r[0] for r in self._fetch(
            "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(?)", (f"dbo.{table}",))}
        return [c for c in columns if c not in existing]

    # ---------- lookups ----------

    def read_lookup(self, table: str, id_column: str) -> dict[int, tuple[str, bool]]:
        rows = self._fetch(f"SELECT {_ident(id_column)}, Description, IsPlaceholder FROM dbo.{_ident(table)}")
        return {int(r[0]): (r[1], bool(r[2])) for r in rows}

    # ---------- patients / admissions ----------

    def read_patients(self) -> dict[str, tuple]:
        """ExternalPatientId -> (PatientId, Race, Gender, HasDemographicConflict)."""
        return {str(r[1]): (int(r[0]), r[2], r[3], int(r[4])) for r in self._fetch(
            "SELECT PatientId, ExternalPatientId, Race, Gender, HasDemographicConflict FROM dbo.Patients")}

    def read_existing_admission_ids(self) -> set[str]:
        return {str(r[0]) for r in self._fetch(
            "SELECT ExternalAdmissionId FROM dbo.Admissions WHERE ExternalAdmissionId IS NOT NULL")}

    def read_admission_ids(self, upload_id: int) -> dict[str, int]:
        return {str(r[1]): int(r[0]) for r in self._fetch(
            "SELECT AdmissionId, ExternalAdmissionId FROM dbo.Admissions WHERE UploadId = ?", (upload_id,))}

    # ---------- uploads ----------

    def create_upload(self, file_name: str, file_size: int | None, total_rows: int) -> int:
        return int(self._scalar(
            "INSERT INTO dbo.Uploads (FileName, FileSizeBytes, Status, TotalRows) "
            "OUTPUT INSERTED.UploadId VALUES (?, ?, N'PROCESSING', ?)",
            (file_name, file_size, total_rows)))

    def upload_exists(self, upload_id: int) -> bool:
        return self._scalar("SELECT COUNT(*) FROM dbo.Uploads WHERE UploadId = ?", (upload_id,)) == 1

    def start_existing_upload(self, upload_id: int, total_rows: int) -> None:
        self.conn.exec_driver_sql(
            "UPDATE dbo.Uploads SET Status = N'PROCESSING', TotalRows = ?, ErrorMessage = NULL "
            "WHERE UploadId = ?", (total_rows, upload_id))

    def complete_upload(self, upload_id: int, total_rows: int, valid_rows: int, rejected_rows: int) -> None:
        self.conn.exec_driver_sql(
            "UPDATE dbo.Uploads SET Status = N'COMPLETED', TotalRows = ?, ValidRows = ?, "
            "RejectedRows = ?, ProcessedAt = SYSUTCDATETIME() WHERE UploadId = ?",
            (total_rows, valid_rows, rejected_rows, upload_id))

    def mark_upload_failed(self, upload_id: int, message: str) -> None:
        self.conn.exec_driver_sql(
            "UPDATE dbo.Uploads SET Status = N'FAILED', ErrorMessage = ?, ProcessedAt = SYSUTCDATETIME() "
            "WHERE UploadId = ?", (message[:4000], upload_id))

    def upload_status(self, upload_id: int) -> str | None:
        return self._scalar("SELECT Status FROM dbo.Uploads WHERE UploadId = ?", (upload_id,))

    def record_failed_upload(self, file_name: str, file_size: int | None, total_rows: int, message: str) -> int:
        return int(self._scalar(
            "INSERT INTO dbo.Uploads (FileName, FileSizeBytes, Status, TotalRows, ErrorMessage, ProcessedAt) "
            "OUTPUT INSERTED.UploadId VALUES (?, ?, N'FAILED', ?, ?, SYSUTCDATETIME())",
            (file_name, file_size, total_rows, message[:4000])))

    # ---------- verification ----------

    def upload_counts(self, upload_id: int) -> dict[str, int]:
        """Row counts that prove what this upload stored."""
        row = self._fetch(
            "SELECT "
            " (SELECT COUNT(*) FROM dbo.Admissions WHERE UploadId = ?),"
            " (SELECT COUNT(*) FROM dbo.AdmissionMedications m JOIN dbo.Admissions a "
            "     ON a.AdmissionId = m.AdmissionId WHERE a.UploadId = ?),"
            " (SELECT COUNT(*) FROM dbo.Admissions a WHERE a.UploadId = ? AND NOT EXISTS "
            "     (SELECT 1 FROM dbo.AdmissionMedications m WHERE m.AdmissionId = a.AdmissionId)),"
            " (SELECT COUNT(DISTINCT PatientId) FROM dbo.Admissions WHERE UploadId = ?),"
            " (SELECT COUNT(*) FROM dbo.DataQualityLogs WHERE UploadId = ?)",
            (upload_id,) * 5)[0]
        return {"admissions": int(row[0]), "medications": int(row[1]),
                "admissions_without_medications": int(row[2]),
                "distinct_patients": int(row[3]), "quality_logs": int(row[4])}
