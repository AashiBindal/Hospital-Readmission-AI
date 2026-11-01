"""Data quality report generation (feeds the DataQualityLogs table and the UI).

Owner: Member 4.
"""
import pandas as pd

from validation import ValidationResult


def compute_quality_metrics(raw_df: pd.DataFrame, clean_df: pd.DataFrame) -> dict:
    """Return metrics such as row counts, % missing per column, duplicates removed."""
    raise NotImplementedError


def build_quality_report(metrics: dict, validation: ValidationResult) -> dict:
    """Combine metrics and validation issues into one JSON-serialisable report."""
    raise NotImplementedError


def save_report(report: dict, output_path: str) -> None:
    """Write the report to disk (JSON) for debugging / demo."""
    raise NotImplementedError
