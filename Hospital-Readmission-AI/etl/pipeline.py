"""ETL pipeline orchestration: raw file -> clean -> validate -> report -> load -> verify.

Owner: Member 4 (ETL + Database).

Run it through main.py (recommended):
    python main.py --dry-run          # clean + validate + reports, no database
    python main.py                    # ... and load into SQL Server
`python pipeline.py ...` still works and forwards to main.py.

Stages
------
1. extract   read diabetic_data.csv (as text) and IDS_mapping.csv - never modified
2. clean     cleaning.clean_with_details()
3. validate  validation.validate_cleaned_data() against the raw file
4. report    cleaned CSV + quality_report.json + validation_report.json + change logs
5. gate      validation.has_critical_errors() -> any ERROR stops here, nothing is loaded
6. load      load_data.load_cleaned_dataset() in one transaction (skipped with --dry-run)
7. verify    counts re-read from SQL Server after COMMIT
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import cleaning
import load_data
import quality_report
import validation
from config import ETLConfig

log = logging.getLogger("etl.pipeline")

CLEANED_FILE = "diabetic_data_cleaned.csv"
REPORT_FILE = "quality_report.json"
VALIDATION_FILE = "validation_report.json"

# Final status values (also used for main.py exit codes)
DRY_RUN_OK, LOADED, VALIDATION_FAILED, LOAD_FAILED = "DRY_RUN_OK", "LOADED", "VALIDATION_FAILED", "LOAD_FAILED"


class _Stages:
    """Records the duration and outcome of each stage for the run summary."""

    def __init__(self):
        self.items: list[dict] = []

    def run(self, name: str, func, *args, **kwargs):
        start = time.perf_counter()
        log.info("Stage %-8s started", name)
        try:
            result = func(*args, **kwargs)
        except Exception as exc:
            self.items.append({"stage": name, "status": "FAILED", "seconds": round(time.perf_counter() - start, 2),
                               "error": str(exc)})
            raise
        self.items.append({"stage": name, "status": "OK", "seconds": round(time.perf_counter() - start, 2)})
        log.info("Stage %-8s finished in %.2fs", name, time.perf_counter() - start)
        return result


def run_pipeline(config: ETLConfig,
                 dry_run: bool = False,
                 upload_id: int | None = None) -> dict:
    """Run every stage and return the run summary (never loads invalid data).

    The summary always contains: status, stages, counts, output files and,
    when loading happened, the load summary with its verification result.
    """
    started = datetime.now(timezone.utc)
    stages = _Stages()
    raw_file, mappings_file, out_dir = config.raw_file, config.mappings_file, config.output_dir
    if out_dir.resolve() == raw_file.parent.resolve():
        raise ValueError("Output folder must differ from the raw folder (raw files are never overwritten)")
    for required in (raw_file, mappings_file):
        if not required.is_file():
            raise FileNotFoundError(f"Input file not found: {required}")

    summary: dict = {"started_at": started.isoformat(timespec="seconds"), "dry_run": dry_run,
                     "config": config.describe(), "stages": stages.items}

    # 1. extract
    raw_df, id_mappings = stages.run("extract", lambda: (
        load_data.read_raw_file(str(raw_file)), load_data.read_id_mappings(str(mappings_file))))
    # 2. clean
    result = stages.run("clean", cleaning.clean_with_details, raw_df, id_mappings)
    # 3. validate
    validation_result = stages.run("validate", validation.validate_cleaned_data, result.data,
                                   id_mappings=id_mappings, raw_df=raw_df, cleaning_result=result,
                                   expected_rows=config.expected_rows)

    # 4. report
    def write_outputs():
        metrics = quality_report.compute_quality_metrics(raw_df, result.data)
        report = quality_report.build_quality_report(metrics, validation_result, result, raw_file.name)
        files = [str(out_dir / CLEANED_FILE), str(out_dir / REPORT_FILE), str(out_dir / VALIDATION_FILE)]
        load_data.write_cleaned_file(result.data, files[0])
        quality_report.save_report(report, files[1])
        validation.generate_validation_report(validation_result, files[2])
        files += quality_report.save_cleaning_logs(result, str(out_dir))
        return report, files

    report, files = stages.run("report", write_outputs)
    print(quality_report.format_console_summary(report))
    summary["output_files"] = files
    summary["counts"] = {
        "raw_rows": len(raw_df), "cleaned_rows": len(result.data),
        "raw_patients": int(raw_df["patient_nbr"].nunique()),
        "cleaned_patients": int(result.data["ExternalPatientId"].nunique()),
        "cleaned_columns": int(result.data.shape[1]),
        "diagnosis_codes_changed": int(len(result.diagnosis_changes)),
    }
    summary["validation"] = {"status": "PASSED" if validation_result.is_valid else "FAILED",
                             "errors": len(validation_result.errors), "warnings": len(validation_result.warnings),
                             "info": len(validation_result.infos)}

    # 5. gate
    if validation.has_critical_errors(validation_result):
        log.error("Validation found %d ERROR(s); nothing was loaded. See %s",
                  len(validation_result.errors), out_dir / VALIDATION_FILE)
        return _finish(summary, VALIDATION_FAILED)
    if dry_run:
        log.info("Dry run: validation passed; database loading skipped")
        return _finish(summary, DRY_RUN_OK)

    # 6. load (+ 7. verify inside load_cleaned_dataset, after COMMIT)
    try:
        load_summary = stages.run(
            "load", load_data.load_cleaned_dataset, result.data, id_mappings,
            file_name=raw_file.name, file_size=raw_file.stat().st_size,
            quality_log_rows=lambda uid: quality_report.to_data_quality_log_rows(report, uid),
            upload_id=upload_id, batch_size=config.batch_size)
    except load_data.LoadError as exc:
        summary["load"] = {"status": "FAILED", "error": str(exc)}
        return _finish(summary, LOAD_FAILED)
    summary["load"] = load_summary
    stages.items.append({"stage": "verify", "status": "OK" if load_summary["verification"]["passed"] else "FAILED",
                         "seconds": 0.0})
    return _finish(summary, LOADED)


def _finish(summary: dict, status: str) -> dict:
    summary["status"] = status
    summary["finished_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return summary


def main() -> None:
    """Backwards compatible: `python pipeline.py ...` runs main.py."""
    import sys

    import main as etl_main

    sys.exit(etl_main.main())


if __name__ == "__main__":
    main()
