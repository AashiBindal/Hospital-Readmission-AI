from fastapi import APIRouter, HTTPException

from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services import prediction_service

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest) -> PredictionResponse:
    """POST /ml/predict — placeholder until a model is trained (returns 501)."""
    try:
        return prediction_service.predict(request)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
