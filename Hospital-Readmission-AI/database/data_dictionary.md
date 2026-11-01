# Data Dictionary (initial draft)

> Will be updated after dataset inspection. Keep in sync with `schema.sql`.

## Users
| Column | Type | Null | Description |
|---|---|---|---|
| UserId | INT IDENTITY | PK | Surrogate key |
| Username | NVARCHAR(100) | No | Unique login name |
| Email | NVARCHAR(255) | No | Unique email |
| PasswordHash | NVARCHAR(255) | No | BCrypt hash (never plain text) |
| FullName | NVARCHAR(200) | Yes | Display name |
| Role | NVARCHAR(30) | No | ADMIN / DOCTOR / NURSE / ANALYST |
| IsActive | BIT | No | Soft disable |
| CreatedAt / UpdatedAt | DATETIME2 | No / Yes | Audit timestamps (UTC) |

## Patients
| Column | Type | Null | Description |
|---|---|---|---|
| PatientId | BIGINT IDENTITY | PK | Surrogate key |
| ExternalPatientId | NVARCHAR(50) | No | Pseudonymised source ID (unique) |
| Gender | NVARCHAR(20) | Yes | Standardised by ETL |
| DateOfBirth | DATE | Yes | Optional — prefer Age for privacy |
| Age | INT | Yes | 0–120 |
| Race | NVARCHAR(50) | Yes | If present in dataset |
| InsuranceType | NVARCHAR(50) | Yes | Payer category |

## Uploads
| Column | Type | Null | Description |
|---|---|---|---|
| UploadId | BIGINT IDENTITY | PK | |
| FileName | NVARCHAR(255) | No | Original file name |
| FileSizeBytes | BIGINT | Yes | |
| UploadedBy | INT | Yes | FK → Users |
| Status | NVARCHAR(30) | No | PENDING / PROCESSING / COMPLETED / FAILED |
| TotalRows / ValidRows / RejectedRows | INT | Yes | ETL counts |
| ErrorMessage | NVARCHAR(MAX) | Yes | Failure reason |
| UploadedAt / ProcessedAt | DATETIME2 | No / Yes | |

## Admissions
| Column | Type | Null | Description |
|---|---|---|---|
| AdmissionId | BIGINT IDENTITY | PK | |
| PatientId | BIGINT | No | FK → Patients |
| UploadId | BIGINT | Yes | FK → Uploads (source file) |
| ExternalAdmissionId | NVARCHAR(50) | Yes | Source encounter ID |
| AdmissionDate / DischargeDate | DATETIME2 | No / Yes | Discharge ≥ admission |
| LengthOfStayDays | INT | Yes | ≥ 0 |
| AdmissionType | NVARCHAR(50) | Yes | Emergency / Elective / Urgent ... |
| Department | NVARCHAR(100) | Yes | |
| PrimaryDiagnosisCode | NVARCHAR(20) | Yes | ICD code |
| NumDiagnoses / NumProcedures / NumMedications / NumLabTests / NumPriorAdmissions | INT | Yes | Model features |
| DischargeDisposition | NVARCHAR(100) | Yes | Home / SNF / ... |
| Readmitted30Days | BIT | Yes | Label (when known) |

## Predictions
| Column | Type | Null | Description |
|---|---|---|---|
| PredictionId | BIGINT IDENTITY | PK | |
| AdmissionId | BIGINT | No | FK → Admissions |
| RiskScore | DECIMAL(5,4) | No | Probability 0–1 |
| RiskLevel | NVARCHAR(10) | No | LOW / MEDIUM / HIGH |
| ModelVersion | NVARCHAR(50) | No | |
| TopFactors | NVARCHAR(MAX) | Yes | JSON |
| PredictedAt | DATETIME2 | No | |

## Followups
| Column | Type | Null | Description |
|---|---|---|---|
| FollowupId | BIGINT IDENTITY | PK | |
| PatientId | BIGINT | No | FK → Patients |
| PredictionId | BIGINT | Yes | FK → Predictions |
| AssignedTo | INT | Yes | FK → Users |
| FollowupType | NVARCHAR(50) | No | CALL / VISIT / MEDICATION_REVIEW |
| ScheduledDate / CompletedDate | DATETIME2 | No / Yes | |
| Status | NVARCHAR(20) | No | SCHEDULED / COMPLETED / MISSED / CANCELLED |
| Notes | NVARCHAR(MAX) | Yes | |

## DataQualityLogs
| Column | Type | Null | Description |
|---|---|---|---|
| LogId | BIGINT IDENTITY | PK | |
| UploadId | BIGINT | No | FK → Uploads |
| RuleName | NVARCHAR(100) | No | e.g. missing_values, date_logic |
| ColumnName | NVARCHAR(100) | Yes | |
| Severity | NVARCHAR(10) | No | INFO / WARNING / ERROR |
| AffectedRows | INT | No | |
| Details | NVARCHAR(MAX) | Yes | |

## Notifications
| Column | Type | Null | Description |
|---|---|---|---|
| NotificationId | BIGINT IDENTITY | PK | |
| UserId | INT | No | FK → Users (recipient) |
| PatientId | BIGINT | Yes | FK → Patients |
| Type | NVARCHAR(30) | No | HIGH_RISK / FOLLOWUP_DUE / UPLOAD_DONE |
| Message | NVARCHAR(500) | No | |
| IsRead | BIT | No | |
