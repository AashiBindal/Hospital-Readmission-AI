"""
main.py - FastAPI service that the Spring Boot backend calls.

Run:
    uvicorn main:app --reload --port 8000
Then open http://127.0.0.1:8000/docs to test it in the browser.

Endpoints:
    GET  /health          -> is the service (and model) alive?
    GET  /model-info      -> metrics, thresholds, top risk factors (for the dashboard)
    POST /predict         -> risk for ONE patient
    POST /predict/batch   -> risk for MANY patients (e.g. after a CSV upload)
"""

from typing import List, Optional, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import predict as predictor

app = FastAPI(
    title="Hospital Readmission Risk API",
    description="Estimates the probability of 30-day readmission from information "
                "available at or before discharge. Decision-support only, not a diagnosis.",
    version="1.0.0",
)

# Lets the React frontend (Vite runs on :5173) and Spring Boot call this service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Patient(BaseModel):
    """Field names match the UCI dataset columns. Only the first three are required."""

    # --- required ---
    age: Union[int, str] = Field(..., description='Age in years (72) or bracket ("[70-80)")')
    time_in_hospital: int = Field(..., ge=1, le=30, description="Days stayed in hospital")
    number_inpatient: int = Field(..., ge=0, le=100, description="Inpatient visits in the previous year")

    # --- optional (missing values are handled by the model) ---
    gender: Optional[str] = Field(None, examples=["Female"])
    race: Optional[str] = Field(None, examples=["Caucasian"])
    admission_type_id: Optional[int] = Field(None, ge=1, le=8)
    discharge_disposition_id: Optional[int] = Field(None, ge=1, le=30)
    admission_source_id: Optional[int] = Field(None, ge=1, le=30)
    num_lab_procedures: Optional[int] = Field(None, ge=0, le=500)
    num_procedures: Optional[int] = Field(None, ge=0, le=50)
    num_medications: Optional[int] = Field(None, ge=0, le=200)
    number_outpatient: Optional[int] = Field(None, ge=0, le=100)
    number_emergency: Optional[int] = Field(None, ge=0, le=100)
    number_diagnoses: Optional[int] = Field(None, ge=0, le=50)
    diag_1: Optional[str] = Field(None, description="Primary diagnosis ICD-9 code, e.g. 428", examples=["428"])
    A1Cresult: Optional[str] = Field(None, examples=["None", ">7", ">8", "Norm"])
    max_glu_serum: Optional[str] = Field(None, examples=["None", ">200", ">300", "Norm"])
    insulin: Optional[str] = Field(None, examples=["No", "Steady", "Up", "Down"])
    change: Optional[str] = Field(None, examples=["No", "Ch"])
    diabetesMed: Optional[str] = Field(None, examples=["Yes", "No"])


class Prediction(BaseModel):
    probability: float
    risk_percent: float
    category: str
    needs_follow_up: bool


class BatchRequest(BaseModel):
    patients: List[Patient] = Field(..., max_length=5000)


@app.get("/health")
def health():
    try:
        predictor._load_bundle()
        return {"status": "ok", "model_loaded": True}
    except FileNotFoundError as error:
        return {"status": "model_missing", "model_loaded": False, "detail": str(error)}


@app.get("/model-info")
def model_info():
    return predictor.model_info()


@app.post("/predict", response_model=Prediction)
def predict_one(patient: Patient):
    try:
        return predictor.predict_risk(patient.model_dump())
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error))


@app.post("/predict/batch", response_model=List[Prediction])
def predict_batch(request: BatchRequest):
    try:
        return predictor.predict_many([p.model_dump() for p in request.patients])
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error))
