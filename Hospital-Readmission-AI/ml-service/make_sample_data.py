"""
make_sample_data.py - creates a SYNTHETIC (fake) dataset with the same columns as the
real UCI "Diabetes 130-US Hospitals" file.

Only for testing that the code runs end to end. A model trained on this fake data means
nothing medically. For the real project, train on the real diabetic_data.csv.

Usage:  python make_sample_data.py
"""

from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
N = 20000

ages = list("0123456789")
age_brackets = [f"[{i * 10}-{i * 10 + 10})" for i in range(10)]
age_probs = [0.002, 0.005, 0.017, 0.037, 0.095, 0.17, 0.22, 0.26, 0.17, 0.024]

df = pd.DataFrame({
    "encounter_id": np.arange(1, N + 1),
    "patient_nbr": rng.integers(1, N * 2, N),
    "race": rng.choice(["Caucasian", "AfricanAmerican", "Hispanic", "Asian", "Other", "?"],
                       N, p=[0.74, 0.19, 0.02, 0.006, 0.015, 0.029]),
    "gender": rng.choice(["Female", "Male"], N, p=[0.54, 0.46]),
    "age": rng.choice(age_brackets, N, p=age_probs),
    "weight": "?",
    "admission_type_id": rng.choice([1, 2, 3, 5, 6], N, p=[0.53, 0.18, 0.18, 0.05, 0.06]),
    "discharge_disposition_id": rng.choice([1, 2, 3, 6, 11, 22], N, p=[0.58, 0.02, 0.14, 0.13, 0.02, 0.11]),
    "admission_source_id": rng.choice([1, 4, 7, 17], N, p=[0.29, 0.06, 0.56, 0.09]),
    "time_in_hospital": np.clip(rng.poisson(3.4, N) + 1, 1, 14),
    "payer_code": "?",
    "medical_specialty": "?",
    "num_lab_procedures": np.clip(rng.normal(43, 19, N).round(), 1, 130).astype(int),
    "num_procedures": rng.choice(range(7), N, p=[0.46, 0.2, 0.12, 0.09, 0.06, 0.04, 0.03]),
    "num_medications": np.clip(rng.normal(16, 8, N).round(), 1, 80).astype(int),
    "number_outpatient": np.clip(rng.poisson(0.4, N), 0, 20),
    "number_emergency": np.clip(rng.poisson(0.2, N), 0, 20),
    "number_inpatient": np.clip(rng.poisson(0.65, N), 0, 15),
    "diag_1": rng.choice(["428", "414", "250.83", "486", "584", "queue", "V57", "715", "560", "?"], N),
    "number_diagnoses": np.clip(rng.normal(7.4, 1.9, N).round(), 1, 16).astype(int),
    "max_glu_serum": rng.choice(["None", ">200", ">300", "Norm"], N, p=[0.95, 0.015, 0.012, 0.023]),
    "A1Cresult": rng.choice(["None", ">7", ">8", "Norm"], N, p=[0.833, 0.037, 0.08, 0.05]),
    "insulin": rng.choice(["No", "Steady", "Up", "Down"], N, p=[0.47, 0.30, 0.12, 0.11]),
    "change": rng.choice(["No", "Ch"], N, p=[0.54, 0.46]),
    "diabetesMed": rng.choice(["Yes", "No"], N, p=[0.77, 0.23]),
})
df["diag_1"] = df["diag_1"].replace("queue", "401")

# Fake "truth": readmission becomes more likely with prior inpatient/emergency visits,
# long stays, many medications and older age. This is invented signal for testing only.
age_num = df["age"].map({b: i * 10 + 5 for i, b in enumerate(age_brackets)})
score = (
    -3.2
    + 0.45 * df["number_inpatient"]
    + 0.15 * df["number_emergency"]
    + 0.06 * df["time_in_hospital"]
    + 0.015 * df["num_medications"]
    + 0.01 * (age_num - 65)
    + 0.25 * (df["diag_1"] == "428")
    + rng.normal(0, 0.8, N)
)
prob = 1 / (1 + np.exp(-score))
labels = np.where(rng.random(N) < prob, "<30", np.where(rng.random(N) < 0.35, ">30", "NO"))
df["readmitted"] = labels

out = Path(__file__).parent / "data"
out.mkdir(exist_ok=True)
df.to_csv(out / "sample_synthetic.csv", index=False)
print(f"Saved {len(df)} fake rows to {out / 'sample_synthetic.csv'}")
print("Share readmitted <30:", round((df['readmitted'] == '<30').mean(), 3))
