"""Inference service used by the /ml/predict route."""
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.model_loader import load_model


def risk_level_for(score: float) -> str:
    """Map a probability to a risk band. Thresholds are placeholders."""
    if score >= 0.6:
        return "HIGH"
    if score >= 0.3:
        return "MEDIUM"
    return "LOW"


def predict(request: PredictionRequest) -> PredictionResponse:
    """Score one admission. TODO (Member 3): implement after training."""
    model = load_model()
    if model is None:
        raise NotImplementedError("No trained model available yet.")
    raise NotImplementedError("Prediction logic not implemented yet.")
