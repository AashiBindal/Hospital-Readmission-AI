"""Entry point for the Hospital Readmission AI ETL.

Owner: Member 4 (ETL + Database).

Run from the etl/ folder:
    python main.py --check-db         # test the SQL Server connection only
    python main.py --dry-run          # clean + validate + reports, no database
    python main.py                    # clean + validate + reports + load + verify

Options override etl/.env values: --input, --mappings, --output-dir,
--batch-size, --expected-rows, --upload-id, --log-level.

Exit codes: 0 success, 1 validation errors (nothing loaded),
            2 load failed (rolled back), 3 configuration/input/connection error.
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from config import ETLConfig, load_config

EXIT_OK, EXIT_VALIDATION, EXIT_LOAD, EXIT_SETUP = 0, 1, 2, 3
SUMMARY_FILE = "etl_run_summary.json"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Hospital Readmission AI - ETL pipeline")
    parser.add_argument("--dry-run", action="store_true", help="clean, validate and report only; no database")
    parser.add_argument("--check-db", action="store_true", help="only test the database connection")
    parser.add_argument("--input", help="raw diabetic_data.csv (default: ETL_RAW_FILE or dataset/raw/)")
    parser.add_argument("--mappings", help="IDS_mapping.csv (default: next to the input file)")
    parser.add_argument("--output-dir", help="where reports and the cleaned CSV are written")
    parser.add_argument("--batch-size", type=int, help="rows per INSERT batch (default 5000)")
    parser.add_argument("--expected-rows", type=int, help="fail validation unless the row count matches")
    parser.add_argument("--upload-id", type=int, help="attach the load to an existing Uploads row")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser.parse_args(argv)


def apply_overrides(config: ETLConfig, args: argparse.Namespace) -> ETLConfig:
    """Command-line options take priority over environment settings."""
    changes = {}
    if args.input:
        changes["raw_file"] = Path(args.input).resolve()
        if not args.mappings:
            changes["mappings_file"] = changes["raw_file"].with_name("IDS_mapping.csv")
    if args.mappings:
        changes["mappings_file"] = Path(args.mappings).resolve()
    if args.output_dir:
        changes["output_dir"] = Path(args.output_dir).resolve()
    if args.batch_size is not None:
        if args.batch_size < 1:
            raise ValueError("--batch-size must be at least 1")
        changes["batch_size"] = args.batch_size
    if args.expected_rows is not None:
        changes["expected_rows"] = args.expected_rows
    return dataclasses.replace(config, **changes) if changes else config


def setup_logging(level: str, log_dir: Path) -> Path:
    """Log to the console and to etl/logs/etl_<timestamp>.log (git-ignored)."""
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / f"etl_{datetime.now():%Y%m%d_%H%M%S}.log"
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)
    for handler in (logging.StreamHandler(sys.stdout), logging.FileHandler(log_file, encoding="utf-8")):
        handler.setFormatter(fmt)
        root.addHandler(handler)
    return log_file


def format_run_summary(summary: dict) -> str:
    """The final ETL execution summary printed at the end of every run."""
    lines = ["", "#" * 72, f"ETL RUN SUMMARY   status = {summary['status']}", "#" * 72]
    for stage in summary.get("stages", []):
        extra = f"  ({stage['error']})" if stage.get("error") else ""
        lines.append(f"  {stage['stage']:<9} {stage['status']:<7} {stage['seconds']:>7.2f}s{extra}")
    counts = summary.get("counts")
    if counts:
        lines.append(f"Rows       : raw {counts['raw_rows']:,} -> cleaned {counts['cleaned_rows']:,}")
        lines.append(f"Patients   : raw {counts['raw_patients']:,} -> cleaned {counts['cleaned_patients']:,}")
    v = summary.get("validation")
    if v:
        lines.append(f"Validation : {v['status']} (errors {v['errors']}, warnings {v['warnings']}, info {v['info']})")
    load = summary.get("load")
    if load and load.get("status") == "LOADED":
        ver = load["verification"]
        lines += [
            f"Upload     : UploadId {load['upload_id']}",
            f"Inserted   : patients {load['patients_inserted']:,}, admissions {load['admissions_inserted']:,}, "
            f"medications {load['medications_inserted']:,}, quality logs {load['quality_logs_inserted']:,}",
            f"Lookups    : {load['lookup_rows_inserted']}",
            f"Existing   : {load['admissions_already_in_database']:,} admissions and "
            f"{load['patients_already_in_database']:,} patients were already in the database (not re-inserted)",
            f"Verified   : {ver['admissions_found_in_database']:,}/{ver['admissions_in_file']:,} admissions, "
            f"{ver['patients_found_in_database']:,}/{ver['patients_in_file']:,} patients in SQL Server -> "
            f"{'PASSED' if ver['passed'] else 'FAILED'}",
        ]
    elif load:
        lines.append(f"Load       : FAILED and rolled back - {load.get('error')}")
    elif summary["status"] == "DRY_RUN_OK":
        lines.append("Load       : skipped (--dry-run)")
    elif summary["status"] == "VALIDATION_FAILED":
        lines.append("Load       : NOT attempted - fix the validation ERRORs first")
    if summary.get("output_files"):
        lines.append("Outputs    :")
        lines += [f"  {f}" for f in summary["output_files"]]
    lines.append("#" * 72)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    log = logging.getLogger("etl.main")
    try:
        config = apply_overrides(load_config(), args)
        log_file = setup_logging(args.log_level, config.log_dir)
        log.info("Log file: %s", log_file)
        log.info("Configuration: %s", config.describe())

        if args.check_db:
            import db

            config.database.validate()
            info = db.test_connection(config.database)
            log.info("Database reachable: %s", info)
            if not info["schema_installed"]:
                log.warning("dbo.Admissions not found - run database/schema.sql before loading")
            return EXIT_OK

        if not args.dry_run:
            # Fail fast: check credentials, driver, connection and schema before cleaning.
            import db

            config.database.validate()
            info = db.test_connection(config.database)
            log.info("Database reachable: %s", info)
            if not info["schema_installed"]:
                log.error("dbo.Admissions not found - run database/schema.sql first")
                return EXIT_SETUP

        import pipeline

        summary = pipeline.run_pipeline(config, dry_run=args.dry_run, upload_id=args.upload_id)
    except (FileNotFoundError, ValueError, ImportError, OSError) as exc:
        logging.getLogger("etl.main").error("Setup error: %s", exc)
        return EXIT_SETUP
    except Exception as exc:  # e.g. driver/connection errors from --check-db
        logging.getLogger("etl.main").exception("Unexpected error: %s", exc)
        return EXIT_SETUP

    summary_path = config.output_dir / SUMMARY_FILE
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")
    summary.setdefault("output_files", []).append(str(summary_path))
    print(format_run_summary(summary))

    return {"DRY_RUN_OK": EXIT_OK, "LOADED": EXIT_OK,
            "VALIDATION_FAILED": EXIT_VALIDATION, "LOAD_FAILED": EXIT_LOAD}.get(summary["status"], EXIT_SETUP)


if __name__ == "__main__":
    sys.exit(main())
