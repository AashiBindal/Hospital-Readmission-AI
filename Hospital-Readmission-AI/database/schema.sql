/* =====================================================================
   Hospital-Readmission-AI — INITIAL schema (Microsoft SQL Server)
   Owner: Member 4

   STATUS: DRAFT. This schema is a starting point and WILL be refined
   after the real dataset has been inspected (column names, types,
   nullability and extra clinical fields may change).

   Run order: schema.sql -> indexes.sql -> views.sql -> stored_procedures.sql
              -> sample_data.sql (optional, synthetic data only)
   ===================================================================== */

IF DB_ID(N'HospitalReadmissionDB') IS NULL
    CREATE DATABASE HospitalReadmissionDB;
GO

USE HospitalReadmissionDB;
GO

/* ---------- Drop in reverse dependency order (dev convenience) ---------- */
IF OBJECT_ID(N'dbo.Notifications',    N'U') IS NOT NULL DROP TABLE dbo.Notifications;
IF OBJECT_ID(N'dbo.Followups',        N'U') IS NOT NULL DROP TABLE dbo.Followups;
IF OBJECT_ID(N'dbo.Predictions',      N'U') IS NOT NULL DROP TABLE dbo.Predictions;
IF OBJECT_ID(N'dbo.DataQualityLogs',  N'U') IS NOT NULL DROP TABLE dbo.DataQualityLogs;
IF OBJECT_ID(N'dbo.Admissions',       N'U') IS NOT NULL DROP TABLE dbo.Admissions;
IF OBJECT_ID(N'dbo.Uploads',          N'U') IS NOT NULL DROP TABLE dbo.Uploads;
IF OBJECT_ID(N'dbo.Patients',         N'U') IS NOT NULL DROP TABLE dbo.Patients;
IF OBJECT_ID(N'dbo.Users',            N'U') IS NOT NULL DROP TABLE dbo.Users;
GO

/* ---------- Users: application users (clinicians, admins, analysts) ---------- */
CREATE TABLE dbo.Users (
    UserId          INT IDENTITY(1,1)  NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    Username        NVARCHAR(100)      NOT NULL CONSTRAINT UQ_Users_Username UNIQUE,
    Email           NVARCHAR(255)      NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
    PasswordHash    NVARCHAR(255)      NOT NULL,           -- BCrypt hash, never plain text
    FullName        NVARCHAR(200)      NULL,
    Role            NVARCHAR(30)       NOT NULL CONSTRAINT DF_Users_Role DEFAULT N'ANALYST',
    IsActive        BIT                NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CreatedAt       DATETIME2          NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt       DATETIME2          NULL,
    CONSTRAINT CK_Users_Role CHECK (Role IN (N'ADMIN', N'DOCTOR', N'NURSE', N'ANALYST'))
);
GO

/* ---------- Patients: de-identified patient master ---------- */
CREATE TABLE dbo.Patients (
    PatientId           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Patients PRIMARY KEY,
    ExternalPatientId   NVARCHAR(50)       NOT NULL CONSTRAINT UQ_Patients_External UNIQUE, -- id from source system (pseudonymised)
    Gender              NVARCHAR(20)       NULL,
    DateOfBirth         DATE               NULL,
    Age                 INT                NULL,
    Race                NVARCHAR(50)       NULL,
    InsuranceType       NVARCHAR(50)       NULL,
    CreatedAt           DATETIME2          NOT NULL CONSTRAINT DF_Patients_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt           DATETIME2          NULL,
    CONSTRAINT CK_Patients_Age CHECK (Age IS NULL OR Age BETWEEN 0 AND 120)
);
GO

/* ---------- Uploads: each raw file pushed through the ETL ---------- */
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

/* ---------- Admissions: one row per hospital stay ---------- */
CREATE TABLE dbo.Admissions (
    AdmissionId             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Admissions PRIMARY KEY,
    PatientId               BIGINT             NOT NULL,
    UploadId                BIGINT             NULL,
    ExternalAdmissionId     NVARCHAR(50)       NULL,
    AdmissionDate           DATETIME2          NOT NULL,
    DischargeDate           DATETIME2          NULL,
    LengthOfStayDays        INT                NULL,
    AdmissionType           NVARCHAR(50)       NULL,
    Department              NVARCHAR(100)      NULL,
    PrimaryDiagnosisCode    NVARCHAR(20)       NULL,      -- e.g. ICD-10
    NumDiagnoses            INT                NULL,
    NumProcedures           INT                NULL,
    NumMedications          INT                NULL,
    NumLabTests             INT                NULL,
    NumPriorAdmissions      INT                NULL,
    DischargeDisposition    NVARCHAR(100)      NULL,
    Readmitted30Days        BIT                NULL,      -- training label when known
    CreatedAt               DATETIME2          NOT NULL CONSTRAINT DF_Admissions_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Admissions_Patients FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId),
    CONSTRAINT FK_Admissions_Uploads  FOREIGN KEY (UploadId)  REFERENCES dbo.Uploads(UploadId),
    CONSTRAINT CK_Admissions_Dates CHECK (DischargeDate IS NULL OR DischargeDate >= AdmissionDate),
    CONSTRAINT CK_Admissions_LOS   CHECK (LengthOfStayDays IS NULL OR LengthOfStayDays >= 0)
);
GO

/* ---------- Predictions: ML output per admission ---------- */
CREATE TABLE dbo.Predictions (
    PredictionId    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Predictions PRIMARY KEY,
    AdmissionId     BIGINT             NOT NULL,
    RiskScore       DECIMAL(5,4)       NOT NULL,          -- 0.0000 – 1.0000
    RiskLevel       NVARCHAR(10)       NOT NULL,
    ModelVersion    NVARCHAR(50)       NOT NULL,
    TopFactors      NVARCHAR(MAX)      NULL,              -- JSON array of contributing features
    PredictedAt     DATETIME2          NOT NULL CONSTRAINT DF_Predictions_PredictedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Predictions_Admissions FOREIGN KEY (AdmissionId) REFERENCES dbo.Admissions(AdmissionId),
    CONSTRAINT CK_Predictions_Score CHECK (RiskScore BETWEEN 0 AND 1),
    CONSTRAINT CK_Predictions_Level CHECK (RiskLevel IN (N'LOW', N'MEDIUM', N'HIGH'))
);
GO

/* ---------- Followups: care actions for at-risk patients ---------- */
CREATE TABLE dbo.Followups (
    FollowupId      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Followups PRIMARY KEY,
    PatientId       BIGINT             NOT NULL,
    PredictionId    BIGINT             NULL,
    AssignedTo      INT                NULL,
    FollowupType    NVARCHAR(50)       NOT NULL,          -- CALL, VISIT, MEDICATION_REVIEW ...
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

/* ---------- Notifications: in-app alerts to users ---------- */
CREATE TABLE dbo.Notifications (
    NotificationId  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
    UserId          INT                NOT NULL,
    PatientId       BIGINT             NULL,
    Type            NVARCHAR(30)       NOT NULL,          -- HIGH_RISK, FOLLOWUP_DUE, UPLOAD_DONE ...
    Message         NVARCHAR(500)      NOT NULL,
    IsRead          BIT                NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
    CreatedAt       DATETIME2          NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Notifications_Users    FOREIGN KEY (UserId)    REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Notifications_Patients FOREIGN KEY (PatientId) REFERENCES dbo.Patients(PatientId)
);
GO
