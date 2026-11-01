"""Loads and caches the trained model artefact (joblib)."""
from pathlib import Path
from typing import Any, Optional

from app.config import get_settings

_model: Optional[Any] = None


def load_model() -> Optional[Any]:
    """Load the model from MODEL_PATH if it exists. Returns None when untrained."""
    global _model
    path = Path(get_settings().model_path)
    if _model is None and path.exists():
        import joblib  # imported lazily so the service starts without a model

        _model = joblib.load(path)
    return _model


def is_model_loaded() -> bool:
    return load_model() is not None
