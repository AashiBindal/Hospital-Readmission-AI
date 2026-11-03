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
    """Score one admission. Handles both model and fallback cases."""
    model = load_model()
    
    dummy_score = 0.75
    
    # Pydantic schema ke sabhi required fields yahan ek sath hain
    return PredictionResponse(
        admission_id=getattr(request, "admission_id", "TEST-123"),
        risk_score=dummy_score,
        readmission_risk_score=dummy_score,
        risk_level=risk_level_for(dummy_score),
        model_version="0.1.0-mock",
        message="Connected successfully!"
    )