# ETL — Python Data Pipeline

**Owner:** Member 4 · **Branch:** `etl-database`

Extract → Clean → Validate → Quality report → Load into SQL Server.

## Setup
```bash
cd etl
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # DB credentials (never commit)
```
PyODBC needs **Microsoft ODBC Driver 18 for SQL Server** installed on your OS.

## Run
```bash
python pipeline.py --check-db                                         # test DB connection
python pipeline.py --input ../dataset/sample/sample_admissions.csv --dry-run
```

## Modules
| File | Purpose |
|---|---|
| `cleaning.py` | column standardisation, duplicates, missing values, dates, categories |
| `validation.py` | required columns, ranges, date logic → `ValidationResult` |
| `quality_report.py` | metrics + issues → report dict → `DataQualityLogs` |
| `load_data.py` | SQLAlchemy engine from env vars, read files, load tables |
| `pipeline.py` | CLI orchestrator |

All functions currently have signatures and docstrings only (`NotImplementedError`), except `build_connection_url`, `get_engine` and `test_connection`, which are ready to use.

## TODO (Member 4)
- Inspect the chosen dataset and update `database/schema.sql` + `database/data_dictionary.md`
- Implement cleaning and validation rules
- Load results and quality logs into the database
