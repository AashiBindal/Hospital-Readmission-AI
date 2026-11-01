# Installation Guide

## Prerequisites
| Tool | Version | Check |
|---|---|---|
| Git | any | `git --version` |
| Node.js | 20 LTS or 22 | `node -v` |
| Java JDK | 17+ | `java -version` |
| Maven | 3.9+ | `mvn -v` |
| Python | 3.11+ | `python --version` |
| SQL Server | 2019 / 2022 (Developer or Express) or Docker | — |
| ODBC Driver 18 for SQL Server | for Python ETL | `odbcinst -q -d` (Linux/macOS) |
| sqlcmd / SSMS / Azure Data Studio | for running SQL scripts | — |

## 1. Clone & environment
```bash
git clone <repo-url> Hospital-Readmission-AI
cd Hospital-Readmission-AI
cp .env.example .env
```
Fill in `DB_USERNAME` and `DB_PASSWORD`. **Never commit `.env`.**

## 2. Database
```bash
cd database
sqlcmd -S localhost,1433 -U <user> -P <password> -i schema.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i indexes.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i views.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i stored_procedures.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i sample_data.sql   # optional
```
Newer `sqlcmd` (go-sqlcmd) may need `-C` to trust a self-signed dev certificate.

## 3. ML service (port 8000)
```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
Verify: http://localhost:8000/ml/health

## 4. Backend (port 8080)
```bash
cd backend-java
cp src/main/resources/application.properties.example src/main/resources/application.properties
export DB_USERNAME=... DB_PASSWORD=...        # PowerShell: $env:DB_USERNAME="..."
mvn spring-boot:run
# or, without a database:
mvn spring-boot:run -Dspring-boot.run.profiles=nodb
```
Verify: http://localhost:8080/api/health and http://localhost:8080/api/health/ml

## 5. Frontend (port 5173)
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open http://localhost:5173 — the header dot turns green when the backend is reachable.

## 6. ETL
```bash
cd etl
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python pipeline.py --check-db
python pipeline.py --input ../dataset/sample/sample_admissions.csv --dry-run
```

## Troubleshooting
| Symptom | Fix |
|---|---|
| Backend fails: `Failed to configure a DataSource` | `application.properties` missing → copy from `.example`, or use `nodb` profile |
| Backend: `Login failed for user` | Check `DB_USERNAME`/`DB_PASSWORD` env vars and SQL auth mode |
| Backend: SSL / certificate error | URL already has `trustServerCertificate=true` for dev |
| Frontend CORS error | Backend `FRONTEND_URL` must be `http://localhost:5173` |
| `/api/health/ml` shows DOWN | Start ML service; check `ML_SERVICE_URL` |
| pyodbc: `Can't open lib 'ODBC Driver 18...'` | Install Microsoft ODBC Driver 18; or set `DB_DRIVER` to the installed version |
| Port already in use | Stop the other process or change the port in env files |
