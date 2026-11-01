# Demo Guide

> Draft script for the hackathon demo. Update as features land.

## Before the demo (T-30 min)
- [ ] SQL Server running; `schema.sql` → `sample_data.sql` executed
- [ ] ML service up: `/ml/health` shows `model_loaded: true`
- [ ] Backend up: `/api/health` and `/api/health/ml` both UP
- [ ] Frontend up at http://localhost:5173
- [ ] Demo CSV ready in `dataset/sample/` (synthetic only)
- [ ] Screenshots saved in `screenshots/` as a fallback

## Demo flow (≈ 5–7 min)
| # | Step | Show | Talking point |
|---|---|---|---|
| 1 | Problem | slide | Readmissions are costly and often preventable |
| 2 | Architecture | README diagram | 4 services, single gateway, SQL Server |
| 3 | Login | `/login` | Role-based access |
| 4 | Upload | `/upload` → sample CSV | Automated ETL |
| 5 | Data quality | `/data-quality` | Duplicates, invalid dates, missing values caught automatically |
| 6 | Predictions | `/predictions` | Risk score + band per admission |
| 7 | Follow-up | `/followups` | Turn prediction into action |
| 8 | Dashboard / Reports | `/dashboard`, `/reports` | Hospital-level insights |
| 9 | Close | — | Limitations, disclaimer, future scope |

## Backup plan
If a live service fails, use screenshots and Swagger UI (`http://localhost:8000/docs`).

## Disclaimer to state
"This is a prototype trained on public/synthetic data and is not a medical device."
