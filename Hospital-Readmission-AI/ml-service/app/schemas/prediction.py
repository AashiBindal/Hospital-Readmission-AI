"""Request/response contracts for /ml/predict.

TODO (Member 3): finalise feature fields after dataset inspection and keep
docs/api_documentation.md in sync.
"""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PredictionRequest(BaseModel):
    admission_id: int = Field(..., description="Admissions.AdmissionId")
    age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[str] = None
    length_of_stay: Optional[int] = Field(None, ge=0)
    num_prior_admissions: Optional[int] = Field(None, ge=0)
    num_diagnoses: Optional[int] = Field(None, ge=0)
    num_medications: Optional[int] = Field(None, ge=0)


class PredictionResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    admission_id: int
    risk_score: float = Field(..., ge=0, le=1)
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    model_version: str
