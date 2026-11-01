# Hospital Readmission Risk - ML Service (Member 3)

Predicts the probability that a patient is readmitted within 30 days, using only
information available at or before discharge. Decision-support only, not a diagnosis.

## Files

| File | What it does |
|---|---|
| `train_model.py` | Cleans data, trains Logistic Regression + Random Forest, picks the best, saves `model.pkl` and `model_info.json` |
| `predict.py` | Loads `model.pkl`; `predict_risk(patient_dict)` returns probability + category |
| `main.py` | FastAPI app: `/predict`, `/predict/batch`, `/model-info`, `/health` |
| `features.py` | Shared feature preparation (used by both training and prediction) |
| `make_sample_data.py` | Makes FAKE data for testing only. Never use for results. |

## Run it (3 steps)

1. Put the real dataset at `data/diabetic_data.csv`
   (UCI "Diabetes 130-US Hospitals for years 1999-2008").
2. Install and train:
   ```bash
   pip install -r requirements.txt
   python train_model.py
   ```
   This creates `model.pkl` and `model_info.json` (your real metrics).
3. Start the API:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   Test in the browser at http://127.0.0.1:8000/docs

## API contract (share with the Spring Boot member)

`POST http://localhost:8000/predict`

Required: `age`, `time_in_hospital`, `number_inpatient`. Everything else is optional.

```json
{
  "age": "[70-80)", "gender": "Female", "race": "Caucasian",
  "admission_type_id": 1, "discharge_disposition_id": 1, "admission_source_id": 7,
  "time_in_hospital": 8, "num_lab_procedures": 55, "num_procedures": 2,
  "num_medications": 22, "number_outpatient": 1, "number_emergency": 2,
  "number_inpatient": 3, "number_diagnoses": 9, "diag_1": "428",
  "A1Cresult": ">8", "max_glu_serum": "None", "insulin": "Up",
  "change": "Ch", "diabetesMed": "Yes"
}
```

Response:

```json
{ "probability": 0.41, "risk_percent": 40.8, "category": "High", "needs_follow_up": true }
```

`POST /predict/batch` takes `{ "patients": [ ... ] }` and returns a list in the same order.
`GET /model-info` returns metrics, thresholds and top risk factors for the dashboard.

## Risk categories

- **Medium**: probability is above the cut-off that catches about 60% of real readmissions
- **High**: top 20% riskiest patients
- **Low**: everything else

The exact cut-offs are saved in `model_info.json` after training.

## Notes

- Patients who died or went to hospice are removed (they cannot be readmitted).
- Only the first visit per patient is kept, so the same person is never in both train and test.
- Real-data ROC-AUC for this dataset is usually around 0.63-0.68. That is normal for readmission prediction.
