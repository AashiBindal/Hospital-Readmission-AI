"""
predict.py - loads model.pkl and gives a readmission risk for one patient (or many).

Used by main.py (the FastAPI app), but you can also test it directly:
    python predict.py
"""

import json
import os
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

from features import prepare_features

# Optional: set the READMISSION_MODEL_PATH environment variable to use a model stored elsewhere.
MODEL_PATH = Path(os.environ.get("READMISSION_MODEL_PATH", Path(__file__).parent / "model.pkl"))


@lru_cache(maxsize=1)
def _load_bundle():
    """Load the model only once (the first time it is needed)."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "model.pkl not found. Run `python train_model.py` first to create it."
        )
    return joblib.load(MODEL_PATH)


def risk_category(probability: float, thresholds: dict) -> str:
    if probability >= thresholds["high"]:
        return "High"
    if probability >= thresholds["medium"]:
        return "Medium"
    return "Low"


def predict_many(patients: list) -> list:
    """patients = list of dicts. Returns one result dict per patient, in the same order."""
    bundle = _load_bundle()
    features = prepare_features(pd.DataFrame(patients))
    probabilities = bundle["pipeline"].predict_proba(features)[:, 1]

    results = []
    for p in probabilities:
        p = float(p)
        category = risk_category(p, bundle["thresholds"])
        results.append({
            "probability": round(p, 4),
            "risk_percent": round(p * 100, 1),
            "category": category,
            "needs_follow_up": category in ("Medium", "High"),
        })
    return results


def predict_risk(patient: dict) -> dict:
    """One patient dict in -> {"probability": 0.23, "category": "High", ...} out."""
    return predict_many([patient])[0]


def model_info() -> dict:
    """Training report (metrics, thresholds, top factors) saved next to model.pkl."""
    info_path = MODEL_PATH.with_name("model_info.json")
    if not info_path.exists():
        return {"message": "model_info.json not found. Run train_model.py first."}
    return json.loads(info_path.read_text())


if __name__ == "__main__":
    example = {
        "age": "[70-80)", "gender": "Female", "race": "Caucasian",
        "admission_type_id": 1, "discharge_disposition_id": 1, "admission_source_id": 7,
        "time_in_hospital": 8, "num_lab_procedures": 55, "num_procedures": 2,
        "num_medications": 22, "number_outpatient": 1, "number_emergency": 2,
        "number_inpatient": 3, "number_diagnoses": 9, "diag_1": "428",
        "A1Cresult": ">8", "max_glu_serum": "None", "insulin": "Up",
        "change": "Ch", "diabetesMed": "Yes",
    }
    print(predict_risk(example))
