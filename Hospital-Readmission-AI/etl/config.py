"""ETL configuration: database settings, file paths and run options.

Owner: Member 4 (ETL + Database).

Values come from environment variables, optionally loaded from a `.env` file
(etl/.env first, then the project-root .env). Nothing secret is hard-coded and
the password is never printed (see ETLConfig.describe()).

Copy etl/.env.example to etl/.env and fill in your own values.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ETL_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ETL_DIR.parent

_TRUE = {"1", "true", "yes", "y", "on"}


def _load_dotenv() -> None:
    """Load etl/.env and the project-root .env if python-dotenv is installed.

    Already-set environment variables always win (override=False).
    """
    try:
        from dotenv import load_dotenv
    except ImportError:  # optional dependency
        return
    for candidate in (ETL_DIR / ".env", PROJECT_ROOT / ".env"):
        if candidate.is_file():
            load_dotenv(candidate, override=False)


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _env_bool(name: str, default: bool) -> bool:
    value = _env(name)
    return default if value is None else value.strip().lower() in _TRUE


def _env_int(name: str, default: int | None) -> int | None:
    value = _env(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be a whole number, got {value!r}") from exc


def _env_path(name: str, default: Path) -> Path:
    value = _env(name)
    path = Path(value) if value else default
    return path if path.is_absolute() else (PROJECT_ROOT / path).resolve()


@dataclass(frozen=True)
class DatabaseConfig:
    host: str = "localhost"
    port: int = 1433
    name: str = "HospitalReadmissionDB"
    username: str | None = None
    password: str | None = field(default=None, repr=False)   # never shown in repr/logs
    driver: str = "ODBC Driver 18 for SQL Server"
    trusted_connection: bool = False      # Windows authentication instead of user/password
    encrypt: bool = True
    trust_server_certificate: bool = True  # local/dev SQL Server uses a self-signed certificate
    instance: str | None = None            # named instance, e.g. SQLEXPRESS

    @property
    def server(self) -> str:
        """Server part of the connection string (host\\instance or host,port)."""
        if self.instance:
            return f"{self.host}\\{self.instance}"
        return f"{self.host},{self.port}"

    def validate(self) -> None:
        """Raise a clear error if the settings cannot produce a connection."""
        if not self.trusted_connection and not (self.username and self.password):
            raise ValueError(
                "Database credentials missing: set DB_USERNAME and DB_PASSWORD in etl/.env, "
                "or set DB_TRUSTED_CONNECTION=yes to use Windows authentication.")


@dataclass(frozen=True)
class ETLConfig:
    database: DatabaseConfig
    raw_file: Path
    mappings_file: Path
    output_dir: Path
    log_dir: Path
    batch_size: int = 5000
    expected_rows: int | None = None

    def describe(self) -> dict:
        """Settings safe to print or log (no password)."""
        db = self.database
        return {
            "server": db.server,
            "database": db.name,
            "authentication": "windows" if db.trusted_connection else f"sql ({db.username})",
            "driver": db.driver,
            "raw_file": str(self.raw_file),
            "mappings_file": str(self.mappings_file),
            "output_dir": str(self.output_dir),
            "log_dir": str(self.log_dir),
            "batch_size": self.batch_size,
            "expected_rows": self.expected_rows,
        }


def load_config() -> ETLConfig:
    """Build the configuration from environment variables / .env files."""
    _load_dotenv()
    database = DatabaseConfig(
        host=_env("DB_HOST", "localhost"),
        port=_env_int("DB_PORT", 1433),
        name=_env("DB_NAME", "HospitalReadmissionDB"),
        username=_env("DB_USERNAME"),
        password=_env("DB_PASSWORD"),
        driver=_env("DB_DRIVER", "ODBC Driver 18 for SQL Server"),
        trusted_connection=_env_bool("DB_TRUSTED_CONNECTION", False),
        encrypt=_env_bool("DB_ENCRYPT", True),
        trust_server_certificate=_env_bool("DB_TRUST_SERVER_CERTIFICATE", True),
        instance=_env("DB_INSTANCE"),
    )
    raw_file = _env_path("ETL_RAW_FILE", PROJECT_ROOT / "dataset" / "raw" / "diabetic_data.csv")
    batch_size = _env_int("ETL_BATCH_SIZE", 5000)
    if batch_size is None or batch_size < 1:
        raise ValueError("ETL_BATCH_SIZE must be a positive whole number")
    return ETLConfig(
        database=database,
        raw_file=raw_file,
        mappings_file=_env_path("ETL_MAPPINGS_FILE", raw_file.with_name("IDS_mapping.csv")),
        output_dir=_env_path("ETL_OUTPUT_DIR", PROJECT_ROOT / "dataset" / "processed"),
        log_dir=_env_path("ETL_LOG_DIR", ETL_DIR / "logs"),
        batch_size=batch_size,
        expected_rows=_env_int("ETL_EXPECTED_ROWS", None),
    )
