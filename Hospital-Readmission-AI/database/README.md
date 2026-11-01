# Database - Microsoft SQL Server

**Owner:** Member 4 · **Database:** `HospitalReadmissionDB` · **Port:** 1433

Stores the Diabetes 130-US Hospitals dataset as cleaned by `etl/` (101,766 admissions,
71,518 patients) plus the tables other modules use (predictions, follow-ups, users, notifications).

## Files
| File | Purpose | Safe to re-run |
|---|---|---|
| `schema.sql` | All tables, keys, CHECK constraints, unique admission index. **No DROP statements** - existing tables are left unchanged | yes |
| `indexes.sql` | Supporting indexes | yes |
| `views.sql` | `vw_AdmissionFeatures` (ML input), `vw_LatestPredictions`, `vw_RiskSummary`, `vw_UploadQualitySummary` | yes |
| `stored_procedures.sql` | `usp_GetHighRiskPatients`, `usp_CompleteUpload` | yes |
| `migrations/001_diabetes_dataset_support.sql` | **Only** for a database created with the original scaffold `schema.sql`: adds the dataset columns/tables in one transaction | yes |
| `verify_load.sql` | Read-only post-load checks with expected counts | yes |
| `sample_data.sql` | Synthetic demo rows; refuses to run if the database already has data | - |
| `data_dictionary.md` | Every table and column | |
| `dataset_to_database_mapping.md` | All 59 cleaned columns -> table.column (generated from `etl/cleaning.py`) | |

## Setup - new database
```powershell
cd database
sqlcmd -S localhost,1433 -U <user> -P <password> -I -i schema.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -I -i indexes.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -I -i views.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -I -i stored_procedures.sql
```
* Windows authentication: replace `-U <user> -P <password>` with `-E`.
* Named instance: `-S localhost\SQLEXPRESS`.
* `-I` (QUOTED_IDENTIFIER ON) is required for the filtered unique index.
* SSMS / Azure Data Studio: open each file and execute in the same order.

## Setup - database created earlier with the original scaffold schema
```powershell
sqlcmd -S localhost,1433 -U <user> -P <password> -I -i migrations\001_diabetes_dataset_support.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -I -i indexes.sql
sqlcmd -S localhost,1433 -U <user> -P <password> -I -i views.sql
```
The migration runs in one transaction (all or nothing) and deletes no data. To make
`AdmissionDate` NULL-able it temporarily removes and re-creates one index and one
CHECK constraint with identical definitions.

## Load the data
Lookup tables are filled by the ETL from `IDS_mapping.csv`. See `etl/README.md`:
```powershell
cd etl
python main.py --dry-run     # clean + validate only
python main.py               # load into SQL Server + verify
```
Then optionally `sqlcmd ... -i database\verify_load.sql`.

## Design decisions
* **Admission-level facts stay on Admissions** (age band, race/gender as recorded, payer, weight) because they can change between stays of the same patient.
* **No invented data:** `AdmissionDate`, `DischargeDate`, `DateOfBirth`, `Age` stay NULL.
* **Original labels kept:** `ReadmissionStatus` = `NO` / `>30` / `<30`; `Readmitted30Days` is derived and a CHECK keeps the two consistent.
* **Medications in a 1:1 table** keeps Admissions readable; `vw_AdmissionFeatures` joins everything back for ML.
* **Lookup tables** keep the original IDs and descriptions; placeholders are flagged, not removed.
* **Duplicate loading is impossible:** unique filtered index on `Admissions.ExternalAdmissionId`; the ETL also skips (and logs) stays already loaded.

## Model-training guidance (for the ML team)
Use `vw_AdmissionFeatures WHERE EligibleForTraining = 1` (excludes the 1,652 stays that ended in death),
decide separately about `DischargedToHospice = 1` (771 stays), split train/test by `ExternalPatientId`,
and expect ~11% positives for `Readmitted30Days`.
