# SQL Server Express scripts

Target: database `HospitalReadmissionDB` on `.\SQLEXPRESS`, Windows authentication.

The scripts in `database/` were already Microsoft SQL Server T-SQL; none of them use Snowflake
syntax. The files here are copies with the fixes listed in each file's header. The originals are unchanged.

These scripts require the database to exist. They never create or drop it.

## Run order

Run from this folder, one file at a time:

```powershell
sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i <file>
```

* `-I` stores views and procedures with `QUOTED_IDENTIFIER ON`. Without it, a procedure that writes to a table with a filtered index fails with error 1934.
* `-b` stops on the first error and returns a non-zero exit code.

| # | File | What it does | Depends on | Changes data |
|---|---|---|---|---|
| 1 | `01_schema.sql` | 12 tables with primary keys, foreign keys, CHECK constraints | Existing database | No |
| 2 | `02_indexes.sql` | 13 supporting indexes | 1 | No |
| 3 | `03_views.sql` | 4 views | 1 | No |
| 4 | `04_stored_procedures.sql` | `usp_GetHighRiskPatients`, `usp_CompleteUpload` | 3 | No |
| 5 | `05_migration_001_diabetes_dataset_support.sql` | No effect on a database built from step 1 | 1-4 | No |
| 6 | `06_migration_002_medisight_hybrid_support.sql` | MediSight columns, 2 tables, 1 view. Replaces `CK_Users_Role` and `CK_Followups_Status`, removes `DF_Users_Role` | 1-5 | No rows |
| 7 | `07_database_check.sql` | Lists tables and columns | 1 | Read only |
| 8 | `08_verify_schema.sql` | Fails if any required object is missing | 1-6 | Read only |
| 9 | `09_verify_load.sql` | Compares row counts with the expected dataset totals. Run after the ETL | ETL load | Read only |

Primary and foreign keys are defined inside the `CREATE TABLE` statements in step 1, so they have no separate script.
Tables are created in foreign-key order. All scripts are safe to re-run.

## Lookup data and ETL

The ETL fills `AdmissionTypes`, `DischargeDispositions` and `AdmissionSources` from `dataset/raw/IDS_mapping.csv`,
then loads patients and admissions in one transaction. No SQL script seeds them, so the IDs and descriptions always come from the source file.

Create `etl/.env` for this server (git ignores this file). `DB_HOST` and `DB_INSTANCE` are separate settings:

```
DB_HOST=localhost
DB_INSTANCE=SQLEXPRESS
DB_NAME=HospitalReadmissionDB
DB_TRUSTED_CONNECTION=yes
DB_DRIVER=ODBC Driver 18 for SQL Server
```

Then:

```powershell
cd etl
python main.py --dry-run
python main.py
```

## Not included

`database/sample_data.sql` is deliberately not copied. It inserts synthetic patients and invented admission dates, and its guard requires an empty database.
