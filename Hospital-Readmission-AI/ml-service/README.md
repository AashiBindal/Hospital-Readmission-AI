# ML Service — FastAPI + scikit-learn

**Owner:** Member 3 · **Branch:** `ml-service` · **Port:** 8000

## Setup
```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
- Health: http://localhost:8000/ml/health
- Swagger UI: http://localhost:8000/docs

### Tests
```bash
pytest
```

## Structure
```
app/
├── main.py              FastAPI app, CORS, router registration
├── config.py            Settings from env (.env)
├── routes/
│   ├── health.py        GET  /ml/health
│   └── prediction.py    POST /ml/predict  (returns 501 until a model exists)
├── schemas/             Pydantic request/response models
├── services/
│   ├── preprocessing.py feature engineering (placeholder)
│   ├── training.py      model training (placeholder)
│   ├── evaluation.py    metrics (placeholder)
│   ├── prediction_service.py  inference (placeholder)
│   └── model_loader.py  lazy joblib loading
└── utils/logger.py
model/                   trained .joblib files (git-ignored)
scripts/train.py         training CLI
tests/test_health.py
```

## Contract
See `docs/api_documentation.md` → *ML Service*. The `PredictionRequest` fields are provisional and will change after dataset inspection.

## TODO (Member 3)
- Choose features after EDA, implement `preprocessing.build_features`
- Baseline model (e.g. Logistic Regression → Random Forest / Gradient Boosting)
- Evaluation report (ROC-AUC, recall on positive class, calibration)
- Implement `/ml/predict` and optionally `/ml/predict/batch`
