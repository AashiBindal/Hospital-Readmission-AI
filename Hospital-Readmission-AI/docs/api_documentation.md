# API Documentation

Status legend: ✅ implemented in scaffold · 🟡 planned (contract draft)

## Backend — Spring Boot (`http://localhost:8080/api`)

### Health
| Status | Method | Path | Response |
|---|---|---|---|
| ✅ | GET | `/health` | `{"status":"UP","service":"backend-java","timestamp":"..."}` |
| ✅ | GET | `/health/ml` | `{"mlService":"UP","response":{...}}` or `{"mlService":"DOWN","error":"..."}` |

### Planned endpoints (Member 2 to finalise)
| Status | Method | Path | Description |
|---|---|---|---|
| 🟡 | POST | `/auth/login` | Returns JWT |
| 🟡 | GET | `/patients?search=&page=&size=` | Paged patients |
| 🟡 | GET | `/patients/{id}` | Patient + admissions |
| 🟡 | POST | `/uploads` (multipart `file`) | Upload CSV → Upload row |
| 🟡 | GET | `/uploads` / `/uploads/{id}` | Upload status |
| 🟡 | GET | `/data-quality/{uploadId}` | Quality logs for an upload |
| 🟡 | POST | `/predictions/run?admissionId=` | Score via ML service |
| 🟡 | GET | `/predictions?riskLevel=HIGH` | Prediction list |
| 🟡 | GET/POST/PATCH | `/followups` | Follow-up CRUD |
| 🟡 | GET | `/notifications` | Current user's notifications |
| 🟡 | GET | `/dashboard/summary` | KPI counts by risk level |
| 🟡 | GET | `/reports/...` | Report data / export |

### Error format
```json
{ "timestamp": "2026-11-01T06:30:00Z", "status": 404, "error": "Not Found", "message": "Patient 42 not found" }
```

## ML Service — FastAPI (`http://localhost:8000`)
Interactive docs: `http://localhost:8000/docs`

| Status | Method | Path | Description |
|---|---|---|---|
| ✅ | GET | `/ml/health` | `{"status":"UP","service":"ml-service","model_loaded":false,"model_version":"0.0.0-untrained","timestamp":"..."}` |
| ✅ (501) | POST | `/ml/predict` | Returns **501 Not Implemented** until a model is trained |

### `POST /ml/predict` (draft contract)
Request
```json
{
  "admission_id": 1,
  "age": 67,
  "gender": "Female",
  "length_of_stay": 6,
  "num_prior_admissions": 2,
  "num_diagnoses": 7,
  "num_medications": 14
}
```
Response
```json
{ "admission_id": 1, "risk_score": 0.62, "risk_level": "HIGH", "model_version": "1.0.0" }
```
Field list will change after feature selection — update this file in the same PR.
