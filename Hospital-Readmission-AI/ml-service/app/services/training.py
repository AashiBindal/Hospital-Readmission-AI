"""Model training.

TODO (Member 3): train a scikit-learn classifier and save it with joblib to MODEL_PATH.
"""
import pandas as pd


def train_model(df: pd.DataFrame, target_column: str = "readmitted_30d"):
    """Train a readmission classifier and return the fitted estimator."""
    raise NotImplementedError("Training not implemented yet.")


def save_model(model, path: str) -> None:
    """Persist a fitted model to disk with joblib."""
    raise NotImplementedError("Model saving not implemented yet.")
