"""FastAPI entry point for the ML service.

Run from the ml-service/ directory:
    uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import health, prediction

settings = get_settings()

app = FastAPI(
    title="Hospital Readmission ML Service",
    version="0.1.0",
    description="Readmission risk prediction API (scaffold).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/ml", tags=["health"])
app.include_router(prediction.router, prefix="/ml", tags=["prediction"])
