# Database — Microsoft SQL Server

**Owner:** Member 4 · **Branch:** `etl-database` · **Database:** `HospitalReadmissionDB` · **Port:** 1433

> ⚠️ `schema.sql` is an **initial draft**. It will be refined after the dataset is inspected.

## Files (run in this order)
| # | File | Purpose |
|---|---|---|
| 1 | `schema.sql` | Creates DB + 8 tables with PKs, FKs, CHECK constraints (drops existing tables — dev only!) |
| 2 | `indexes.sql` | Starter indexes |
| 3 | `views.sql` | `vw_LatestPredictions`, `vw_RiskSummary`, `vw_UploadQualitySummary` |
| 4 | `stored_procedures.sql` | `usp_GetHighRiskPatients`, `usp_CompleteUpload` |
| 5 | `sample_data.sql` | Synthetic rows for local dev (optional) |

```bash
sqlcmd -S localhost,1433 -U <user> -P <password> -i schema.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i indexes.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i views.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i stored_procedures.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -i sample_data.sql
```
Or open each file in SSMS / Azure Data Studio and execute.

### SQL Server via Docker (optional)
```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<StrongPassword!1>" \
  -p 1433:1433 --name hra-sql -d mcr.microsoft.com/mssql/server:2022-latest
```

## Tables
Users · Patients · Admissions · Uploads · Predictions · Followups · DataQualityLogs · Notifications.
Column-level details: [data_dictionary.md](data_dictionary.md). ER diagram: [../docs/database_design.md](../docs/database_design.md).
