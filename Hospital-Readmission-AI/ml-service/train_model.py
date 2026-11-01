"""
train_model.py - trains the hospital readmission model and saves it as model.pkl

What this script does (same steps as the plan):
  1. Load the CSV
  2. Create the target  (readmitted within 30 days = 1, otherwise 0)
  3. Clean the data and pick features (only info known at/before discharge)
  4. Split into train (80%) and test (20%)
  5. Train Logistic Regression and Random Forest, compare them
  6. Evaluate with ROC-AUC, Precision, Recall, F1
  7. Decide risk-category thresholds (Low / Medium / High)
  8. Save everything into model.pkl (+ model_info.json for humans)

Usage:
    python train_model.py                              # uses data/diabetic_data.csv
    python train_model.py --data data/other_file.csv
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from features import CATEGORICAL_COLUMNS, NUMERIC_COLUMNS, prepare_features

BASE_DIR = Path(__file__).parent
RANDOM_STATE = 42

# Patients who died or went to hospice cannot be readmitted, so they would confuse the model.
DISCHARGED_DEAD_OR_HOSPICE = {11, 13, 14, 19, 20, 21}

# We aim to catch at least this share of the patients who really come back.
TARGET_RECALL = 0.60
# The top 20% riskiest patients are labelled "High".
HIGH_RISK_PERCENTILE = 80


def load_and_clean(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise SystemExit(
            f"Dataset not found: {path}\n"
            "Download 'diabetic_data.csv' (UCI: Diabetes 130-US Hospitals for years 1999-2008) "
            "and put it in the data/ folder, or pass --data <path>."
        )
    df = pd.read_csv(path)
    print(f"Loaded {len(df):,} rows, {df.shape[1]} columns")

    df = df.replace("?", np.nan)

    # Remove patients who died / went to hospice
    before = len(df)
    df = df[~df["discharge_disposition_id"].isin(DISCHARGED_DEAD_OR_HOSPICE)]
    print(f"Removed {before - len(df):,} rows (patient died or went to hospice)")

    # Keep only the first visit of each patient. Otherwise the same person could be in both
    # train and test sets and the scores would look better than they really are.
    if "patient_nbr" in df.columns:
        before = len(df)
        df = df.sort_values("encounter_id").drop_duplicates("patient_nbr", keep="first")
        print(f"Removed {before - len(df):,} repeat visits (kept 1 row per patient)")

    return df.reset_index(drop=True)


def build_pipeline(model) -> Pipeline:
    """Preprocessing + model in one object, so predict.py needs no extra steps."""
    numeric = Pipeline([
        ("fill_missing", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    categorical = Pipeline([
        ("fill_missing", SimpleImputer(strategy="most_frequent")),
        ("encode", OneHotEncoder(handle_unknown="ignore", min_frequency=20)),
    ])
    preprocess = ColumnTransformer([
        ("num", numeric, NUMERIC_COLUMNS),
        ("cat", categorical, CATEGORICAL_COLUMNS),
    ])
    return Pipeline([("preprocess", preprocess), ("model", model)])


def evaluate(name, pipeline, X_test, y_test):
    proba = pipeline.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, proba)
    print(f"  {name:<20} ROC-AUC = {auc:.4f}")
    return auc, proba


def pick_thresholds(y_test, proba):
    """
    Turn probabilities into categories.
      Medium boundary: lowest-risk cut-off that still catches TARGET_RECALL of real readmissions.
      High boundary:   top 20% riskiest patients.
    """
    precision, recall, thresholds = precision_recall_curve(y_test, proba)
    ok = np.where(recall[:-1] >= TARGET_RECALL)[0]
    t_medium = float(thresholds[ok[-1]]) if len(ok) else float(np.percentile(proba, 50))
    t_high = float(np.percentile(proba, HIGH_RISK_PERCENTILE))
    if t_high <= t_medium:
        t_high = t_medium * 1.25
    return t_medium, t_high


def top_factors(pipeline, how_many=15):
    """Which inputs matter most to the model (for the 'important factors' chart)."""
    names = pipeline.named_steps["preprocess"].get_feature_names_out()
    model = pipeline.named_steps["model"]
    if hasattr(model, "feature_importances_"):
        scores = model.feature_importances_
    else:
        scores = np.abs(model.coef_[0])
    order = np.argsort(scores)[::-1][:how_many]
    return [{"feature": str(names[i]).split("__", 1)[-1], "importance": round(float(scores[i]), 4)}
            for i in order]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(BASE_DIR / "data" / "diabetic_data.csv"))
    parser.add_argument("--out", default=str(BASE_DIR / "model.pkl"))
    args = parser.parse_args()

    # 1-3. Load, clean, target, features
    df = load_and_clean(Path(args.data))
    y = (df["readmitted"] == "<30").astype(int)
    X = prepare_features(df)
    print(f"Readmitted within 30 days: {y.mean():.1%} of patients\n")

    # 4. Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    # 5. Train both models
    print("Training models...")
    candidates = {
        "LogisticRegression": LogisticRegression(max_iter=1000),
        "RandomForest": RandomForestClassifier(
            n_estimators=300, min_samples_leaf=20, n_jobs=-1, random_state=RANDOM_STATE
        ),
    }
    results = {}
    for name, model in candidates.items():
        pipeline = build_pipeline(model)
        pipeline.fit(X_train, y_train)
        auc, proba = evaluate(name, pipeline, X_test, y_test)
        results[name] = (auc, pipeline, proba)

    best_name = max(results, key=lambda k: results[k][0])
    best_auc, best_pipeline, best_proba = results[best_name]
    print(f"\nBest model: {best_name} (ROC-AUC {best_auc:.4f})")

    # 6-7. Thresholds and metrics
    t_medium, t_high = pick_thresholds(y_test, best_proba)
    flagged = (best_proba >= t_medium).astype(int)
    metrics = {
        "roc_auc": round(float(best_auc), 4),
        "precision_at_medium_threshold": round(float(precision_score(y_test, flagged, zero_division=0)), 4),
        "recall_at_medium_threshold": round(float(recall_score(y_test, flagged)), 4),
        "f1_at_medium_threshold": round(float(f1_score(y_test, flagged)), 4),
        "share_of_patients_flagged": round(float(flagged.mean()), 4),
    }
    tn, fp, fn, tp = confusion_matrix(y_test, flagged).ravel()
    print("\nResults on the 20% test patients the model never saw:")
    for key, value in metrics.items():
        print(f"  {key}: {value}")
    print(f"  confusion matrix: caught={tp}, missed={fn}, false alarms={fp}, correctly low={tn}")
    print(f"  thresholds: Medium >= {t_medium:.3f}, High >= {t_high:.3f}")

    # Show every model for the report
    comparison = {name: round(float(res[0]), 4) for name, res in results.items()}

    # 8. Save
    bundle = {
        "pipeline": best_pipeline,
        "thresholds": {"medium": t_medium, "high": t_high},
        "model_name": best_name,
    }
    joblib.dump(bundle, args.out)

    info = {
        "model_name": best_name,
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "data_file": Path(args.data).name,
        "patients_used": int(len(df)),
        "readmission_rate": round(float(y.mean()), 4),
        "model_comparison_roc_auc": comparison,
        "metrics": metrics,
        "thresholds": {"medium": round(t_medium, 4), "high": round(t_high, 4)},
        "top_factors": top_factors(best_pipeline),
    }
    info_path = Path(args.out).with_name("model_info.json")
    info_path.write_text(json.dumps(info, indent=2))
    print(f"\nSaved model  -> {args.out}")
    print(f"Saved report -> {info_path}")


if __name__ == "__main__":
    main()
