"""Validation rules applied to cleaned data before loading.

Owner: Member 4.
"""
from dataclasses import dataclass, field

import pandas as pd


@dataclass
class ValidationIssue:
    rule: str
    column: str | None
    row_count: int
    severity: str = "WARNING"  # INFO | WARNING | ERROR
    details: str = ""


@dataclass
class ValidationResult:
    is_valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)


def check_required_columns(df: pd.DataFrame, required: list[str]) -> list[ValidationIssue]:
    """Ensure all required columns are present."""
    raise NotImplementedError


def check_value_ranges(df: pd.DataFrame) -> list[ValidationIssue]:
    """Check numeric ranges (e.g. age 0–120, length of stay >= 0)."""
    raise NotImplementedError


def check_date_logic(df: pd.DataFrame) -> list[ValidationIssue]:
    """Check discharge date >= admission date, no future dates, etc."""
    raise NotImplementedError


def validate(df: pd.DataFrame) -> ValidationResult:
    """Run all validation rules and aggregate the result."""
    raise NotImplementedError
