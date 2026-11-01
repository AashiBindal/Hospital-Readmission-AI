"""
features.py - shared feature preparation.

Training (train_model.py) and prediction (predict.py) BOTH call prepare_features(),
so a new patient is always converted into numbers exactly the same way as the
training data. Only information available at or before discharge is used.
"""

import numpy as np
import pandas as pd

# Age comes as brackets in the UCI dataset, e.g. "[70-80)". We turn it into the middle value.
AGE_MAP = {
    "[0-10)": 5, "[10-20)": 15, "[20-30)": 25, "[30-40)": 35, "[40-50)": 45,
    "[50-60)": 55, "[60-70)": 65, "[70-80)": 75, "[80-90)": 85, "[90-100)": 95,
}

NUMERIC_COLUMNS = [
    "age_num",
    "time_in_hospital",
    "num_lab_procedures",
    "num_procedures",
    "num_medications",
    "number_outpatient",
    "number_emergency",
    "number_inpatient",
    "number_diagnoses",
    "total_prior_visits",  # engineered: outpatient + emergency + inpatient
]

CATEGORICAL_COLUMNS = [
    "gender",
    "race",
    "admission_type_id",
    "discharge_disposition_id",
    "admission_source_id",
    "diag_1_group",  # engineered: ICD-9 code grouped into a disease family
    "A1Cresult",
    "max_glu_serum",
    "insulin",
    "change",
    "diabetesMed",
]

FEATURE_COLUMNS = NUMERIC_COLUMNS + CATEGORICAL_COLUMNS

# Raw columns we expect to receive (missing ones are simply treated as unknown).
RAW_NUMERIC = [
    "time_in_hospital", "num_lab_procedures", "num_procedures", "num_medications",
    "number_outpatient", "number_emergency", "number_inpatient", "number_diagnoses",
]
RAW_CATEGORICAL = [
    "gender", "race", "admission_type_id", "discharge_disposition_id",
    "admission_source_id", "A1Cresult", "max_glu_serum", "insulin", "change", "diabetesMed",
]


def diag_group(code) -> str:
    """Group an ICD-9 diagnosis code (like '250.83' or '428') into a disease family."""
    if code is None or (isinstance(code, float) and np.isnan(code)):
        return "Unknown"
    code = str(code).strip()
    if code in ("", "?", "nan", "None"):
        return "Unknown"
    if code[0] in ("V", "v", "E", "e"):
        return "Other"
    try:
        value = float(code)
    except ValueError:
        return "Other"
    if int(value) == 250:
        return "Diabetes"
    if 390 <= value <= 459 or int(value) == 785:
        return "Circulatory"
    if 460 <= value <= 519 or int(value) == 786:
        return "Respiratory"
    if 520 <= value <= 579 or int(value) == 787:
        return "Digestive"
    if 800 <= value <= 999:
        return "Injury"
    if 710 <= value <= 739:
        return "Musculoskeletal"
    if 580 <= value <= 629 or int(value) == 788:
        return "Genitourinary"
    if 140 <= value <= 239:
        return "Neoplasms"
    return "Other"


def _age_to_number(value):
    """Accept '[70-80)' brackets or a plain number like 72."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return np.nan
    if isinstance(value, str):
        value = value.strip()
        if value in AGE_MAP:
            return AGE_MAP[value]
        try:
            return float(value)
        except ValueError:
            return np.nan
    return float(value)


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Raw patient rows -> clean feature table with exactly FEATURE_COLUMNS."""
    df = df.copy()

    # Make sure every raw column exists, even if the caller did not send it.
    for col in RAW_NUMERIC + RAW_CATEGORICAL + ["age", "diag_1"]:
        if col not in df.columns:
            df[col] = np.nan

    out = pd.DataFrame(index=df.index)
    out["age_num"] = df["age"].apply(_age_to_number)
    for col in RAW_NUMERIC:
        out[col] = pd.to_numeric(df[col], errors="coerce")

    out["total_prior_visits"] = (
        out["number_outpatient"].fillna(0)
        + out["number_emergency"].fillna(0)
        + out["number_inpatient"].fillna(0)
    )

    out["diag_1_group"] = df["diag_1"].apply(diag_group)
    for col in RAW_CATEGORICAL:
        series = df[col].replace("?", np.nan)
        # ids like 1, 1.0 and "1" should all mean the same thing
        series = series.apply(
            lambda v: str(int(v)) if isinstance(v, (int, float, np.integer, np.floating))
            and not pd.isna(v) and float(v) == int(v) else v
        )
        # Missing stays missing (NaN). The model pipeline later fills it with the most
        # common value seen in training, which avoids skewing the risk score.
        out[col] = series.map(lambda v: np.nan if pd.isna(v) else str(v)).astype(object)

    return out[FEATURE_COLUMNS]
