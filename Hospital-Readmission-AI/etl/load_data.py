"""Database loading utilities (SQL Server via SQLAlchemy + pyodbc).

Owner: Member 4. Credentials come ONLY from environment variables.
"""
import os
from urllib.parse import quote_plus

import pandas as pd


def build_connection_url() -> str:
    """Build a SQLAlchemy URL for SQL Server from DB_* environment variables."""
    driver = os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "1433")
    name = os.getenv("DB_NAME", "HospitalReadmissionDB")
    user = os.getenv("DB_USERNAME", "")
    password = os.getenv("DB_PASSWORD", "")
    return (
        f"mssql+pyodbc://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{name}"
        f"?driver={quote_plus(driver)}&TrustServerCertificate=yes"
    )


def get_engine():
    """Create a SQLAlchemy engine (lazy import so the module loads without the driver)."""
    from sqlalchemy import create_engine

    return create_engine(build_connection_url(), fast_executemany=True)


def test_connection() -> bool:
    """Return True if `SELECT 1` succeeds against the configured database."""
    from sqlalchemy import text

    with get_engine().connect() as conn:
        return conn.execute(text("SELECT 1")).scalar() == 1


def read_raw_file(path: str) -> pd.DataFrame:
    """Read a raw CSV/Excel upload into a DataFrame."""
    raise NotImplementedError


def load_dataframe(df: pd.DataFrame, table: str, if_exists: str = "append") -> int:
    """Insert a DataFrame into `table`; return number of rows written."""
    raise NotImplementedError


def log_quality_report(report: dict, upload_id: int) -> None:
    """Persist a quality report into dbo.DataQualityLogs."""
    raise NotImplementedError
