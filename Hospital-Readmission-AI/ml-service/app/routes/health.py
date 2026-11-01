from datetime import datetime, timezone

from fastapi import APIRouter

from app.config import get_settings
from app.schemas.health import HealthResponse
from app.services.model_loader import is_model_loaded

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """GET /ml/health — liveness check used by backend-java."""
    return HealthResponse(
        status="UP",
        service="ml-service",
        model_loaded=is_model_loaded(),
        model_version=get_settings().model_version,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
