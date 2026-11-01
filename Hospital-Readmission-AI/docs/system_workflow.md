# System Workflow

## 1. Upload & ETL
```mermaid
flowchart LR
    A[User uploads CSV] --> B[Backend creates Upload row<br/>status = PENDING]
    B --> C[ETL: read file]
    C --> D[Clean<br/>dedupe, nulls, dates, categories]
    D --> E[Validate<br/>required cols, ranges, date logic]
    E --> F[Quality report]
    F --> G[(DataQualityLogs)]
    E -->|valid rows| H[(Patients / Admissions)]
    H --> I[Upload status = COMPLETED]
    E -->|fatal error| J[Upload status = FAILED]
```

## 2. Prediction
```mermaid
flowchart LR
    A[New admissions loaded] --> B[Backend builds feature payload]
    B --> C[POST /ml/predict]
    C --> D[ML: preprocess → model.predict_proba]
    D --> E[risk_score + risk_level]
    E --> F[(Predictions)]
    F -->|HIGH| G[(Notifications)]
    F -->|HIGH| H[Suggest Followup]
```

## 3. Clinical follow-up
1. Doctor/Nurse opens **Predictions**, filters HIGH risk.
2. Creates a **Follow-up** (call, visit, medication review) and assigns it.
3. Assignee completes it; status → COMPLETED.
4. **Reports** show follow-up completion rate and outcomes.

## 4. Model lifecycle
1. ETL produces `dataset/processed/training.csv`.
2. `python -m scripts.train --data ...` trains and saves `model/readmission_model.joblib`.
3. Evaluation metrics recorded in `docs/` or a report.
4. Restart ML service (or reload) — `/ml/health` shows `model_loaded: true`.

## Status values
| Entity | Values |
|---|---|
| Uploads.Status | PENDING → PROCESSING → COMPLETED / FAILED |
| Predictions.RiskLevel | LOW (< 0.3) · MEDIUM (0.3–0.6) · HIGH (≥ 0.6) — placeholder thresholds |
| Followups.Status | SCHEDULED → COMPLETED / MISSED / CANCELLED |
