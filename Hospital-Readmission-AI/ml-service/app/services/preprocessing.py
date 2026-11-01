"""Feature preprocessing for training and inference.

TODO (Member 3): implement encoding, scaling and feature engineering.
The SAME function must be used at training and prediction time.
"""
import pandas as pd


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Transform cleaned admission records into model-ready features."""
    raise NotImplementedError("Preprocessing not implemented yet.")


def get_feature_columns() -> list[str]:
    """Return the ordered list of feature columns expected by the model."""
    raise NotImplementedError("Feature list not defined yet.")
