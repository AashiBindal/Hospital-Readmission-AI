/* SQL Server Express copy for .\SQLEXPRESS, generated from database/schema.sql.
   Run with: sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i 01_schema.sql
   Changes from the original: CREATE DATABASE removed; the database must already exist. */

/* =====================================================================
   Hospital-Readmission-AI - database schema (Microsoft SQL Server)
   Owner: Member 4 (ETL + Database)

   Designed for the Diabetes 130-US Hospitals dataset as cleaned by
   etl/cleaning.py (COLUMN_SPEC, 59 columns) and checked by etl/validation.py.

   SAFE TO RE-RUN
     * Nothing is dropped or deleted. Each table/index is created only if it
       does not exist yet.
     * If you created the database earlier with the ORIGINAL scaffold
       schema.sql, existing tables are NOT changed by this file - run
       migrations/001_diabetes_dataset_support.sql instead to upgrade them.

   RUN ORDER (fresh database)
     1. schema.sql              (this file)
     2. indexes.sql
     3. views.sql
     4. stored_procedures.sql
     Lookup tables (AdmissionTypes, DischargeDispositions, AdmissionSources)
     are filled by the ETL from IDS_mapping.csv.

   HOW TO RUN
     see database/sqlserver/README.md
     -I turns QUOTED_IDENTIFIER ON, required for the filtered unique index.
   ===================================================================== */

USE HospitalReadmissionDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ---------- Users: application users ---------- */
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE dbo.Users (
    UserId          INT IDENTITY(1,1)  NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    Username        NVARCHAR(100)      NOT NULL CONSTRAINT UQ_Users_Username UNIQUE,
    Email           NVARCHAR(255)      NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
    PasswordHash    NVARCHAR(255)      NOT NULL,
    FullName        NVARCHAR(200)      NULL,
    Role            NVARCHAR(30)       NOT NULL CONSTRAINT DF_Users_Role DEFAULT N'ANALYST',
    IsActive        BIT                NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CreatedAt       DATETIME2          NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2          NULL,
    CONSTRAINT CK_Users_Role CHECK (Role IN (N'ADMIN', N'DOCTOR', N'NURSE', N'ANALYST'))
);
GO

/* ---------- Patients: one row per patient_nbr ----------
   Race/Gender are filled only when all of the patient's admissions agree;
   the admission-level values are stored on dbo.Admissions. */
IF OBJECT_ID(N'dbo.Patients', N'U') IS NULL
CREATE TABLE dbo.Patients (
    PatientId               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Patients PRIMARY KEY,
    ExternalPatientId       NVARCHAR(50)       NOT NULL CONSTRAINT UQ_Patients_External UNIQUE,
    Gender                  NVARCHAR(20)       NULL,
    DateOfBirth             DATE               NULL,        -- not in the source; never generated
    Age                     INT                NULL,        -- source has age bands -> Admissions.AgeGroup
    Race                    NVARCHAR(50)       NULL,
    InsuranceType           NVARCHAR(50)       NULL,        -- payer is per stay -> Admissions.PayerCode
    HasDemographicConflict  BIT                NOT NULL CONSTRAINT DF_Patients_HasDemographicConflict DEFAULT 0,
    CreatedAt               DATETIME2          NOT NULL CONSTRAINT DF_Patients_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt               DATETIME2          NULL,
    CONSTRAINT CK_Patients_Age CHECK (Age IS NULL OR Age BETWEEN 0 AND 120)
);
GO

/* ---------- Uploads: each file processed by the ETL ---------- */
IF OBJECT_ID(N'dbo.Uploads', N'U') IS NULL
CREATE TABLE dbo.Uploads (
    UploadId        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Uploads PRIMARY KEY,
    FileName        NVARCHAR(255)      NOT NULL,
    FileSizeBytes   BIGINT             NULL,
    UploadedBy      INT                NULL,
    Status          NVARCHAR(30)       NOT NULL CONSTRAINT DF_Uploads_Status DEFAULT N'PENDING',
    TotalRows       INT                NULL,
    ValidRows       INT                NULL,
    RejectedRows    INT                NULL,
    ErrorMessage    NVARCHAR(MAX)      NULL,
    UploadedAt      DATETIME2          NOT NULL CONSTRAINT DF_Uploads_UploadedAt DEFAULT SYSUTCDATETIME(),
    ProcessedAt     DATETIME2          NULL,
    CONSTRAINT FK_Uploads_Users FOREIGN KEY (UploadedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Uploads_Status CHECK (Status IN (N'PENDING', N'PROCESSING', N'COMPLETED', N'FAILED'))
);
GO

/* ---------- Lookup tables: original IDs and descriptions from IDS_mapping.csv ---------- */
IF OBJECT_ID(N'dbo.AdmissionTypes', N'U') IS NULL
CREATE TABLE dbo.AdmissionTypes (
    AdmissionTypeId  INT            NOT NULL CONSTRAINT PK_AdmissionTypes PRIMARY KEY,
    Description      NVARCHAR(150)  NOT NULL,
    IsPlaceholder    BIT            NOT NULL CONSTRAINT DF_AdmissionTypes_IsPlaceholder DEFAULT 0
);
GO

IF OBJECT_ID(N'dbo.DischargeDispositions', N'U') IS NULL
CREATE TABLE dbo.DischargeDispositions (
    DischargeDispositionId  INT            NOT NULL CONSTRAINT PK_DischargeDispositions PRIMARY KEY,
    Description             NVARCHAR(150)  NOT NULL,
    IsPlaceholder           BIT            NOT NULL CONSTRAINT DF_DischargeDispositions_IsPlaceholder DEFAULT 0
);
GO

IF OBJECT_ID(N'dbo.AdmissionSources', N'U') IS NULL
CREATE TABLE dbo.AdmissionSources (
    AdmissionSourceId  INT            NOT NULL CONSTRAINT PK_AdmissionSources PRIMARY KEY,
    Description        NVARCHAR(150)  NOT NULL,
    IsPlaceholder      BIT            NOT NULL CONSTRAINT DF_AdmissionSources_IsPlaceholder DEFAULT 0
);
GO

/* ---------- Admissions: one row per encounter_id ---------- */
IF OBJECT_ID(N'dbo.Admissions', N'U') IS NULL
CREATE TABLE dbo.Admissions (
    AdmissionId             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Admissions PRIMARY KEY,
    PatientId               BIGINT             NOT NULL,
    UploadId                BIGINT             NULL,
    ExternalAdmissionId     NVARCHAR(50)       NULL,
    AdmissionDate           DATETIME2          NULL,        -- not in the source; never generated
    DischargeDate           DATETIME2          NULL,        -- not in the source; never generated
    LengthOfStayDays        INT                NULL,
    AdmissionType           NVARCHAR(50)       NULL,
    Department              NVARCHAR(100)      NULL,
    PrimaryDiagnosisCode    NVARCHAR(20)       NULL,        -- ICD-9-CM
    NumDiagnoses            INT                NULL,
    NumProcedures           INT                NULL,
    NumMedications          INT                NULL,
    NumLabTests             INT                NULL,
    NumPriorAdmissions      INT                NULL,
    DischargeDisposition    NVARCHAR(150)      NULL,
    Readmitted30Days        BIT                NULL,
    CreatedAt               DATETIME2          NOT NULL CONSTRAINT DF_Admissions_CreatedAt DEFAULT SYSUTCDATETIME(),
    AgeGroup                NVARCHAR(10)       NULL,
    RaceAtAdmission         NVARCHAR(50)       NULL,
    GenderAtAdmission       NVARCHAR(20)       NULL,
    WeightRange             NVARCHAR(10)       NULL,
    PayerCode               NVARCHAR(10)       NULL,
    AdmissionTypeId         INT                NULL,
    DischargeDispositionId  INT                NULL,
    AdmissionSourceId       INT                NULL,
    AdmissionSource         NVARCHAR(100)      NULL,
    SecondaryDiagnosisCode  NVARCHAR(20)       NULL,
    TertiaryDiagnosisCode   NVARCHAR(20)       NULL,
    NumOutpatientVisits     INT                NULL,
    NumEmergencyVisits      INT                NULL,
    MaxGluSerum             NVARCHAR(10)       NULL,
    A1CResult               NVARCHAR(10)       NULL,
    ReadmissionStatus       NVARCHAR(5)        NULL,
    ExpiredAtDischarge      BIT                NOT NULL CONSTRAINT DF_Admissions_ExpiredAtDischarge DEFAULT 0,
    DischargedToHospice     BIT                NOT NULL CONSTRAINT DF_Admissions_DischargedToHospice DEFAULT 0,
    CONSTRAINT FK_Admissions_Patients              FOREIGN KEY (PatientId)              REFERENCES dbo.Patients(PatientId),
    CONSTRAINT FK_Admissions_Uploads               FOREIGN KEY (UploadId)               REFERENCES dbo.Uploads(UploadId),
    CONSTRAINT FK_Admissions_AdmissionTypes        FOREIGN KEY (AdmissionTypeId)        REFERENCES dbo.AdmissionTypes(AdmissionTypeId),
    CONSTRAINT FK_Admissions_DischargeDispositions FOREIGN KEY (DischargeDispositionId) REFERENCES dbo.DischargeDispositions(DischargeDispositionId),
    CONSTRAINT FK_Admissions_AdmissionSources      FOREIGN KEY (AdmissionSourceId)      REFERENCES dbo.AdmissionSources(AdmissionSourceId),
    CONSTRAINT CK_Admissions_Dates     CHECK (DischargeDate IS NULL OR DischargeDate >= AdmissionDate),
    CONSTRAINT CK_Admissions_LOS       CHECK (LengthOfStayDays IS NULL OR LengthOfStayDays >= 0),
    CONSTRAINT CK_Admissions_NewCounts CHECK ((NumOutpatientVisits IS NULL OR NumOutpatientVisits >= 0)
                                          AND (NumEmergencyVisits IS NULL OR NumEmergencyVisits >= 0)),
    CONSTRAINT CK_Admissions_AgeGroup CHECK (AgeGroup IN (
        N'[0-10)', N'[10-20)', N'[20-30)', N'[30-40)', N'[40-50)',
        N'[50-60)', N'[60-70)', N'[70-80)', N'[80-90)', N'[90-100)')),
    CONSTRAINT CK_Admissions_RaceAtAdmission CHECK (RaceAtAdmission IN (
        N'Caucasian', N'AfricanAmerican', N'Hispanic', N'Asian', N'Other')),
    CONSTRAINT CK_Admissions_GenderAtAdmission CHECK (GenderAtAdmission IN (
        N'Female', N'Male', N'Unknown/Invalid')),
    CONSTRAINT CK_Admissions_MaxGluSerum CHECK (MaxGluSerum IN (
        N'NotTested', N'Norm', N'>200', N'>300')),
    CONSTRAINT CK_Admissions_A1CResult CHECK (A1CResult IN (
        N'NotTested', N'Norm', N'>7', N'>8')),
    CONSTRAINT CK_Admissions_ReadmissionStatus CHECK (ReadmissionStatus IN (
        N'NO', N'>30', N'<30')),
    CONSTRAINT CK_Admissions_Readmitted30Days CHECK (
        ReadmissionStatus IS NULL OR (Readmitted30Days IS NOT NULL AND
        Readmitted30Days = CASE WHEN ReadmissionStatus = N'<30' THEN 1 ELSE 0 END)),
    CONSTRAINT CK_Admissions_ExpiredAtDischarge CHECK (
        ExpiredAtDischarge = CASE WHEN DischargeDispositionId IN (11, 19, 20, 21) THEN 1 ELSE 0 END),
    CONSTRAINT CK_Admissions_DischargedToHospice CHECK (
        DischargedToHospice = CASE WHEN DischargeDispositionId IN (13, 14) THEN 1 ELSE 0 END)
);
GO

/* One row per source encounter. Filtered so manually entered rows without an
   ExternalAdmissionId (e.g. sample_data.sql) remain allowed. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE object_id = OBJECT_ID(N'dbo.Admissions') AND name = N'UX_Admissions_ExternalAdmissionId')
    CREATE UNIQUE INDEX UX_Admissions_ExternalAdmissionId ON dbo.Admissions (ExternalAdmissionId)
        WHERE ExternalAdmissionId IS NOT NULL;
GO

/* ---------- AdmissionMedications: the 23 diabetes medications, 1:1 with Admissions ---------- */
IF OBJECT_ID(N'dbo.AdmissionMedications', N'U') IS NULL
CREATE TABLE dbo.AdmissionMedications (
    AdmissionId              BIGINT        NOT NULL CONSTRAINT PK_AdmissionMedications PRIMARY KEY,
    Metformin                NVARCHAR(10)  NOT NULL,
    Repaglinide              NVARCHAR(10)  NOT NULL,
    Nateglinide              NVARCHAR(10)  NOT NULL,
    Chlorpropamide           NVARCHAR(10)  NOT NULL,
    Glimepiride              NVARCHAR(10)  NOT NULL,
    Acetohexamide            NVARCHAR(10)  NOT NULL,
    Glipizide                NVARCHAR(10)  NOT NULL,
    Glyburide                NVARCHAR(10)  NOT NULL,
    Tolbutamide              NVARCHAR(10)  NOT NULL,
    Pioglitazone             NVARCHAR(10)  NOT NULL,
    Rosiglitazone            NVARCHAR(10)  NOT NULL,
    Acarbose                 NVARCHAR(10)  NOT NULL,
    Miglitol                 NVARCHAR(10)  NOT NULL,
    Troglitazone             NVARCHAR(10)  NOT NULL,
    Tolazamide               NVARCHAR(10)  NOT NULL,
    Examide                  NVARCHAR(10)  NOT NULL,
    Citoglipton              NVARCHAR(10)  NOT NULL,
    Insulin                  NVARCHAR(10)  NOT NULL,
    GlyburideMetformin       NVARCHAR(10)  NOT NULL,
    GlipizideMetformin       NVARCHAR(10)  NOT NULL,
    GlimepiridePioglitazone  NVARCHAR(10)  NOT NULL,
    MetforminRosiglitazone   NVARCHAR(10)  NOT NULL,
    MetforminPioglitazone    NVARCHAR(10)  NOT NULL,
    MedicationChanged        BIT           NOT NULL,
    DiabetesMedPrescribed    BIT           NOT NULL,
    CONSTRAINT FK_AdmissionMedications_Admissions FOREIGN KEY (AdmissionId) REFERENCES dbo.Admissions(AdmissionId),
    CONSTRAINT CK_AdmissionMedications_Values CHECK (
        Metformin               IN (N'No', N'Steady', N'Up', N'Down') AND
        Repaglinide             IN (N'No', N'Steady', N'Up', N'Down') AND
        Nateglinide             IN (N'No', N'Steady', N'Up', N'Down') AND
        Chlorpropamide          IN (N'No', N'Steady', N'Up', N'Down') AND
        Glimepiride             IN (N'No', N'Steady', N'Up', N'Down') AND
        Acetohexamide           IN (N'No', N'Steady', N'Up', N'Down') AND
        Glipizide               IN (N'No', N'Steady', N'Up', N'Down') AND
        Glyburide               IN (N'No', N'Steady', N'Up', N'Down') AND
        Tolbutamide             IN (N'No', N'Steady', N'Up', N'Down') AND
        Pioglitazone            IN (N'No', N'Steady', N'Up', N'Down') AND
        Rosiglitazone           IN (N'No', N'Steady', N'Up', N'Down') AND
        Acarbose                IN (N'No', N'Steady', N'Up', N'Down') AND
        Miglitol                IN (N'No', N'Steady', N'Up', N'Down') AND
        Troglitazone            IN (N'No', N'Steady', N'Up', N'Down') AND
        Tolazamide              IN (N'No', N'Steady', N'Up', N'Down') AND
        Examide                 IN (N'No', N'Steady', N'Up', N'Down') AND
        Citoglipton             IN (N'No', N'Steady', N'Up', N'Down') AND
        Insulin                 IN (N'No', N'Steady', N'Up', N'Down') AND
        GlyburideMetformin      IN (N'No', N'Steady', N'Up', N'Down') AND
        GlipizideMetformin      IN (N'No', N'Steady', N'Up', N'Down') AND
        GlimepiridePioglitazone IN (N'No', N'Steady', N'Up', N'Down') AND
        MetforminRosiglitazone  IN (N'No', N'Steady', N'Up', N'Down') AND
        MetforminPioglitazone   IN (N'No', N'Steady', N'Up', N'Down'))
);
GO

/* ---------- Predictions: ML output per admission (ML service / backend) ---------- */
IF OBJECT_ID(N'dbo.Predictions', N'U') IS NULL
CREATE TABLE dbo.Predictions (
    PredictionId    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Predictions PRIMARY KEY,
    AdmissionId     BIGINT             NOT NULL,
    RiskScore       DECIMAL(5,4)       NOT NULL,
    RiskLevel       NVARCHAR(10)       NOT NULL,
    ModelVersion    NVARCHAR(50)       NOT NULL,
    TopFactors      NVARCHAR(MAX)      NULL,
    PredictedAt     DATETIME2          NOT NULL CONSTRAINT DF_Predictions_PredictedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Predictions_Admissions FOREIGN KEY (AdmissionId) REFERENCES dbo.Admissions(AdmissionId),
    CONSTRAINT CK_Predictions_Score CHECK (RiskScore BETWEEN 0 AND 1),
    CONSTRAINT CK_Predictions_Level CHECK (RiskLevel IN (N'LOW', N'MEDIUM', N'HIGH'))
);
GO

/* ---------- Followups: care actions for at-risk patients ---------- */
IF OBJECT_ID(N'dbo.Followups', N'U') IS NULL
CREATE TABLE dbo.Followups (
    FollowupId      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Followups PRIMARY KEY,
    PatientId       BIGINT             NOT NULL,
    PredictionId    BIGINT             NULL,
    AssignedTo      INT                NULL,
    FollowupType    NVARCHAR(50)       NOT NULL,
    ScheduledDate   DATETIME2          NOT NULL,
    CompletedDate   DATETIME2          NULL,
    Status          NVARCHAR(20)       NOT NULL CONSTRAINT DF_Followups_Status DEFAULT N'SCHEDULED',
    Notes           NVARCHAR(MAX)      NULL,
    CreatedAt       DATETIME2          NOT NULL CONSTRAINT DF_Followups_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Followups_Patients    FOREIGN KEY (PatientId)    REFERENCES dbo.Patients(PatientId),
    CONSTRAINT FK_Followups_Predictions FOREIGN KEY (PredictionId) REFERENCES dbo.Predictions(PredictionId),
    CONSTRAINT FK_Followups_Users       FOREIGN KEY (AssignedTo)   REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Followups_Status CHECK (Status IN (N'SCHEDULED', N'COMPLETED', N'MISSED', N'CANCELLED'))
);
GO

/* ---------- DataQualityLogs: ETL validation findings per upload ---------- */
IF OBJECT_ID(N'dbo.DataQualityLogs', N'U') IS NULL
CREATE TABLE dbo.DataQualityLogs (
    LogId           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DataQualityLogs PRIMARY KEY,
    UploadId        BIGINT             NOT NULL,
    RuleName        NVARCHAR(100)      NOT NULL,
    ColumnName      NVARCHAR(100)      NULL,
    Severity        NVARCHAR(10)       NOT NULL,
    AffectedRows    INT                NOT NULL CONSTRAINT DF_DQL_AffectedRows DEFAULT 0,
    Details         NVARCHAR(MAX)      NULL,
    LoggedAt        DATETIME2          NOT NULL CONSTRAINT DF_DQL_LoggedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_DataQualityLogs_Uploads FOREIGN KEY (UploadId) REFERENCES dbo.Uploads(UploadId),
    CONSTRAINT CK_DataQualityLogs_Severity CHECK (Severity IN (N'INFO', N'WARNING', N'ERROR'))
);
GO

/* ---------- Notifications: in-app alerts ---------- */
IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
CREATE TABLE dbo.Notifications (
    NotificationId  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
    UserId          INT                NOT NULL,
    PatientId       BIGINT             NULL,
    Type            NVARCHAR(30)       NOT NULL,
    Message         NVARCHAR(500)      NOT NULL,
    IsRead          BIT                NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
    CreatedAt       DATETIME2          NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Notifications_Users    FOREIGN KEY (UserId)    REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Notifications_Patients FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId)
);
GO

PRINT N'schema.sql completed (existing tables were left unchanged).';
GO
