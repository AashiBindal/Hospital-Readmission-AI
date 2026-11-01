# Data Cleaning Report - Diabetes 130-US Hospitals (1999-2008)

Owner: Member 4 (ETL + Database). Produced by `etl/cleaning.py` + `etl/validation.py`
on the full `diabetic_data.csv` (all numbers below come from an actual run;
`quality_report.json` and `validation_report.json` are regenerated on every run).

## 1. Input
| File | Rows | Columns | Notes |
|---|---|---|---|
| diabetic_data.csv | 101,766 | 50 | one row per encounter; `?` = missing; no dates |
| IDS_mapping.csv | 63 IDs | 3 sections | admission type (8), discharge disposition (30), admission source (25) |

* `encounter_id` unique: yes · exact duplicate rows: 0 · empty cells: 0
* Unique patients (`patient_nbr`): 71,518 · patients with more than one admission: 16,773
* Every ID used in the data exists in IDS_mapping.csv (8 / 26 / 17 distinct IDs used)
* Raw files are only read, never modified (checksums unchanged after every run)

## 2. Result
| | Raw | Cleaned |
|---|---|---|
| Rows (admissions) | 101,766 | **101,766** (none removed) |
| Patients | 71,518 | **71,518** |
| Columns | 50 | 59 (named exactly like the SQL Server columns) |
| Validation | | **PASSED** - 0 errors, 0 warnings, 20 info, 18/18 checks |

## 3. Approved transformations (everything else is copied unchanged)
| Step | Rows / values affected | What happened |
|---|---|---|
| Rename columns | 50 columns | raw names -> SQL names (`encounter_id` -> `ExternalAdmissionId`, ...) |
| Duplicates | 0 | reported only; rows are never deleted |
| `?` -> NULL | 192,849 values | race 2,273 · weight 98,569 · payer_code 40,256 · medical_specialty 49,949 · diag_1 21 · diag_2 358 · diag_3 1,423 |
| Lab "not tested" | 181,168 values | `max_glu_serum` 96,420 and `A1Cresult` 84,748: `None` -> `NotTested` (so no tool mistakes it for NULL) |
| change / diabetesMed | 101,766 rows | `Ch`/`No` -> 1/0 and `Yes`/`No` -> 1/0 |
| Lookup descriptions | 101,766 rows | text added from IDS_mapping.csv; placeholder text (`NULL`, `Not Mapped`, ...) -> NULL, ID kept |
| Diagnosis codes | 5,732 values | leading zeros restored for 43 verified ICD-9 codes only (primary 2,646 · secondary 1,560 · tertiary 1,526) |
| Labels / flags | 101,766 rows | `Readmitted30Days` from `<30`; `ExpiredAtDischarge` 1,652; `DischargedToHospice` 771 |
| Patient demographics | 126 patients | patient-level race/gender NULL where stays disagree; admission values kept |
| Type casting | 0 invalid values | strict whole-number rule; any unconvertible value is recorded and blocks loading |

### Diagnosis codes - why and how
The source stored ICD-9 codes 001-099 without leading zeros (e.g. `38` instead of `038`
septicemia). Verified before changing: all 43 short codes are whole numbers 3-99,
their 3-digit forms never appear in the data, and every 3-digit form is a valid
ICD-9-CM category (chapter 1, infectious diseases). Only these listed values are
changed; V-codes, E-codes and decimals are never touched. Every change is written to
`diagnosis_code_changes.csv` (one line per value: encounter, column, original, new,
rule, description). Most frequent: `38->038` 2,325 · `41->041` 1,114 · `8->008` 904 ·
`70->070` 600.

## 4. Kept exactly as in the source
Admission-level race, gender and age band; `readmitted` (`NO` 54,864 · `>30` 35,545 ·
`<30` 11,357); all 23 medication values; all counts; all IDs. Validation compares
these column by column with the raw file on every run.

## 5. Not invented
No admission, discharge or birth dates (the source has none - the database columns stay
NULL). No imputation of missing values. No numeric ages (only the recorded bands).

## 6. Missing values after cleaning (NULL)
| Column | NULL rows | % |
|---|---|---|
| WeightRange | 98,569 | 96.86 |
| Department | 49,949 | 49.08 |
| PayerCode | 40,256 | 39.56 |
| AdmissionType (placeholder IDs) | 10,396 | 10.22 |
| AdmissionSource (placeholder IDs) | 7,067 | 6.94 |
| DischargeDisposition (placeholder IDs) | 4,680 | 4.60 |
| PatientRace | 2,533 | 2.49 |
| RaceAtAdmission | 2,273 | 2.23 |
| TertiaryDiagnosisCode | 1,423 | 1.40 |
| SecondaryDiagnosisCode | 358 | 0.35 |
| PrimaryDiagnosisCode | 21 | 0.02 |
| PatientGender | 10 | 0.01 |

## 7. Notes for model training (ML team)
1. Exclude the 1,652 `ExpiredAtDischarge = 1` stays from training and evaluation - they cannot be readmitted.
2. Decide explicitly about the 771 `DischargedToHospice = 1` stays.
3. Split train/test **by patient** (`ExternalPatientId`) - 16,773 patients have several stays.
4. Target imbalance: `Readmitted30Days = 1` for 11.16% - report recall / ROC-AUC, not only accuracy.
5. `Examide` and `Citoglipton` are `No` in every row (zero variance).
6. `MedicationChanged = 1` also covers changes other than an Up/Down dose (19,308 stays) - this is the source's definition.
