"""ETL pipeline orchestrator: extract -> clean -> validate -> report -> load.

Usage (from etl/):
    python pipeline.py --input ../dataset/sample/sample_admissions.csv --dry-run
    python pipeline.py --check-db
"""
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("etl.pipeline")


def run_pipeline(input_path: str, upload_id: int | None = None, dry_run: bool = False) -> dict:
    """Run the full ETL for one file and return a summary dict.

    TODO (Member 4): wire the steps below once each module is implemented.
        df_raw = load_data.read_raw_file(input_path)
        df_clean = cleaning.clean(df_raw)
        result = validation.validate(df_clean)
        report = quality_report.build_quality_report(
            quality_report.compute_quality_metrics(df_raw, df_clean), result)
        if not dry_run: load_data.load_dataframe(df_clean, "Admissions"); ...
    """
    log.info("[scaffold] pipeline called with input=%s upload_id=%s dry_run=%s",
             input_path, upload_id, dry_run)
    return {"input": input_path, "status": "NOT_IMPLEMENTED"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Hospital data ETL pipeline")
    parser.add_argument("--input", help="Path to raw CSV file")
    parser.add_argument("--upload-id", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true", help="Do not write to the database")
    parser.add_argument("--check-db", action="store_true", help="Only test the DB connection")
    args = parser.parse_args()

    if args.check_db:
        from dotenv import load_dotenv

        from load_data import test_connection

        load_dotenv()
        log.info("Database reachable: %s", test_connection())
        return
    if not args.input:
        parser.error("--input is required unless --check-db is used")
    log.info("Result: %s", run_pipeline(args.input, args.upload_id, args.dry_run))


if __name__ == "__main__":
    main()
