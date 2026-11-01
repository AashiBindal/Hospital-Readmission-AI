"""Data cleaning functions for raw hospital admission files.

Owner: Member 4. Signatures only — logic to be implemented after dataset inspection.
"""
from typing import Iterable

import pandas as pd


def standardize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Lower-case, strip and snake_case all column names."""
    raise NotImplementedError


def remove_duplicates(df: pd.DataFrame, subset: Iterable[str] | None = None) -> pd.DataFrame:
    """Drop duplicate rows (optionally on a subset of key columns)."""
    raise NotImplementedError


def handle_missing_values(df: pd.DataFrame, strategy: dict[str, str] | None = None) -> pd.DataFrame:
    """Impute or drop missing values per column according to `strategy`."""
    raise NotImplementedError


def normalize_dates(df: pd.DataFrame, date_columns: Iterable[str]) -> pd.DataFrame:
    """Parse date columns into pandas datetime, coercing invalid values to NaT."""
    raise NotImplementedError


def normalize_categories(df: pd.DataFrame) -> pd.DataFrame:
    """Standardise categorical values (e.g. gender 'M'/'Male' -> 'Male')."""
    raise NotImplementedError


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Run all cleaning steps in order and return the cleaned DataFrame."""
    raise NotImplementedError
