# Database Design

> Initial design — will be refined after dataset inspection. Source of truth: `database/schema.sql`.

## ER diagram
```mermaid
erDiagram
    Users ||--o{ Uploads : "uploads"
    Users ||--o{ Followups : "assigned"
    Users ||--o{ Notifications : "receives"
    Patients ||--o{ Admissions : "has"
    Patients ||--o{ Followups : "has"
    Patients ||--o{ Notifications : "about"
    Uploads ||--o{ Admissions : "source of"
    Uploads ||--o{ DataQualityLogs : "produces"
    Admissions ||--o{ Predictions : "scored by"
    Predictions ||--o{ Followups : "triggers"

    Users {
        int UserId PK
        nvarchar Username
        nvarchar Role
    }
    Patients {
        bigint PatientId PK
        nvarchar ExternalPatientId
        int Age
    }
    Admissions {
        bigint AdmissionId PK
        bigint PatientId FK
        bigint UploadId FK
        datetime2 AdmissionDate
        bit Readmitted30Days
    }
    Uploads {
        bigint UploadId PK
        int UploadedBy FK
        nvarchar Status
    }
    Predictions {
        bigint PredictionId PK
        bigint AdmissionId FK
        decimal RiskScore
        nvarchar RiskLevel
    }
    Followups {
        bigint FollowupId PK
        bigint PatientId FK
        bigint PredictionId FK
        int AssignedTo FK
    }
    DataQualityLogs {
        bigint LogId PK
        bigint UploadId FK
        nvarchar Severity
    }
    Notifications {
        bigint NotificationId PK
        int UserId FK
        bigint PatientId FK
    }
```

## Conventions
- Schema `dbo`, PascalCase names, singular PK `<Table>Id` (table names plural).
- Named constraints: `PK_`, `FK_<Child>_<Parent>`, `CK_`, `DF_`, `UQ_`, `IX_`.
- Timestamps `DATETIME2` in **UTC** (`SYSUTCDATETIME()`).
- Enumerations enforced with `CHECK` constraints.

## Privacy
- Store pseudonymised `ExternalPatientId`, never names, phone numbers or national IDs.
- Prefer `Age` over `DateOfBirth`.

## Open questions (resolve after dataset inspection)
- Which diagnosis coding system (ICD-9 / ICD-10)? Separate `Diagnoses` table?
- Separate `Medications` / `LabResults` tables vs aggregated counts?
- Store engineered features in a `ModelFeatures` table for reproducibility?
