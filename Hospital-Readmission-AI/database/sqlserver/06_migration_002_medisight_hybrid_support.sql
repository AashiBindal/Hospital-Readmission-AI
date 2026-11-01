/* SQL Server Express copy for .\SQLEXPRESS, generated from database/migrations/002_medisight_hybrid_support.sql.
   Run with: sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i 06_migration_002_medisight_hybrid_support.sql
   Changes from the original: CK_Users_Role and CK_Followups_Status are replaced only while they
   are still the old version; DF_Users_Role (ANALYST) is removed; stops if
   ANALYST users exist. */

/* ================================================================
   MediSight - Hybrid Database Support
   Real dataset + Frontend demo patients
   Microsoft SQL Server

   Run after:
   1. schema.sql
   2. migrations/001_diabetes_dataset_support.sql (if required)

   This is an additive migration. It does not drop patient,
   admission, prediction, upload or historical records.
   ================================================================ */

USE HospitalReadmissionDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ================================================================
   1. USERS - MediSight application fields
   ================================================================ */

IF COL_LENGTH('dbo.Users', 'Phone') IS NULL
    ALTER TABLE dbo.Users ADD Phone CHAR(10) NULL;
GO

IF COL_LENGTH('dbo.Users', 'LicenseId') IS NULL
    ALTER TABLE dbo.Users ADD LicenseId NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.Users', 'AvatarInitials') IS NULL
    ALTER TABLE dbo.Users ADD AvatarInitials NVARCHAR(5) NULL;
GO

IF COL_LENGTH('dbo.Users', 'LastLogin') IS NULL
    ALTER TABLE dbo.Users ADD LastLogin DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.Users', 'Department') IS NULL
    ALTER TABLE dbo.Users ADD Department NVARCHAR(50) NULL;
GO

/* Replace the old role constraint with MediSight roles.
   Dropped only while it still allows ANALYST, so a re-run changes nothing. */
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Users')
      AND name = 'CK_Users_Role'
      AND definition LIKE '%ANALYST%'
)
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_Role;
GO

/* Stop if a user still holds the retired role: such a row needs a human
   decision and must not be rewritten here. */
IF EXISTS (SELECT 1 FROM dbo.Users WHERE Role = N'ANALYST')
    THROW 50002, N'dbo.Users contains ANALYST rows. Assign them a new role first.', 1;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Users')
      AND name = 'CK_Users_Role'
)
ALTER TABLE dbo.Users
ADD CONSTRAINT CK_Users_Role
CHECK (Role IN (N'ADMIN', N'DOCTOR', N'NURSE'));
GO

/* The old default was ANALYST, which CK_Users_Role no longer allows and which
   would make every INSERT without a Role fail. Removing it means Role must
   always be stated, so nobody receives a clinical role by default. */
IF EXISTS (
    SELECT 1 FROM sys.default_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Users')
      AND name = 'DF_Users_Role'
      AND definition LIKE '%ANALYST%'
)
    ALTER TABLE dbo.Users DROP CONSTRAINT DF_Users_Role;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Users')
      AND name = 'CK_Users_Phone'
)
ALTER TABLE dbo.Users
ADD CONSTRAINT CK_Users_Phone
CHECK (Phone IS NULL OR Phone NOT LIKE '%[^0-9]%'
       AND LEN(Phone) = 10);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Users')
      AND name = 'CK_Users_Department'
)
ALTER TABLE dbo.Users
ADD CONSTRAINT CK_Users_Department
CHECK (Department IS NULL OR Department IN (
    N'Cardiology', N'Medicine', N'Pediatrics',
    N'Orthopedics', N'General'
));
GO

/* ================================================================
   2. PATIENTS - distinguish real dataset and demo patients
   ================================================================ */

IF COL_LENGTH('dbo.Patients', 'PatientCode') IS NULL
    ALTER TABLE dbo.Patients ADD PatientCode NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.Patients', 'SourceType') IS NULL
BEGIN
    ALTER TABLE dbo.Patients
    ADD SourceType NVARCHAR(10) NOT NULL
        CONSTRAINT DF_Patients_SourceType DEFAULT N'DATASET'
        WITH VALUES;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Patients')
      AND name = 'UX_Patients_PatientCode'
)
CREATE UNIQUE INDEX UX_Patients_PatientCode
ON dbo.Patients(PatientCode)
WHERE PatientCode IS NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Patients')
      AND name = 'CK_Patients_SourceType'
)
ALTER TABLE dbo.Patients
ADD CONSTRAINT CK_Patients_SourceType
CHECK (SourceType IN (N'DATASET', N'DEMO'));
GO

/* Exact age and gender are available only where supplied.
   Never derive an exact age from a source age band. */

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Patients')
      AND name = 'CK_Patients_Gender'
)
ALTER TABLE dbo.Patients
ADD CONSTRAINT CK_Patients_Gender
CHECK (Gender IS NULL OR Gender IN (
    N'Male', N'Female', N'Other', N'Unknown/Invalid'
));
GO

/* ================================================================
   3. UPLOADS - upload source and risk counts
   ================================================================ */

IF COL_LENGTH('dbo.Uploads', 'HighRiskFound') IS NULL
    ALTER TABLE dbo.Uploads ADD HighRiskFound INT NULL;
GO

IF COL_LENGTH('dbo.Uploads', 'SourceType') IS NULL
BEGIN
    ALTER TABLE dbo.Uploads
    ADD SourceType NVARCHAR(10) NOT NULL
        CONSTRAINT DF_Uploads_SourceType DEFAULT N'DATASET'
        WITH VALUES;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Uploads')
      AND name = 'CK_Uploads_SourceType'
)
ALTER TABLE dbo.Uploads
ADD CONSTRAINT CK_Uploads_SourceType
CHECK (SourceType IN (N'DATASET', N'DEMO'));
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Uploads')
      AND name = 'CK_Uploads_HighRiskFound'
)
ALTER TABLE dbo.Uploads
ADD CONSTRAINT CK_Uploads_HighRiskFound
CHECK (HighRiskFound IS NULL OR HighRiskFound >= 0);
GO

/* ================================================================
   4. ADMISSIONS - application-specific clinical fields
   ================================================================ */

IF COL_LENGTH('dbo.Admissions', 'SourceType') IS NULL
BEGIN
    ALTER TABLE dbo.Admissions
    ADD SourceType NVARCHAR(10) NOT NULL
        CONSTRAINT DF_Admissions_SourceType DEFAULT N'DATASET'
        WITH VALUES;
END;
GO

IF COL_LENGTH('dbo.Admissions', 'Department') IS NULL
    ALTER TABLE dbo.Admissions ADD Department NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'PrimaryDiagnosis') IS NULL
    ALTER TABLE dbo.Admissions ADD PrimaryDiagnosis NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'PriorAdmissions') IS NULL
    ALTER TABLE dbo.Admissions ADD PriorAdmissions INT NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'MedicationsCount') IS NULL
    ALTER TABLE dbo.Admissions ADD MedicationsCount INT NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'ComorbiditiesCount') IS NULL
    ALTER TABLE dbo.Admissions ADD ComorbiditiesCount INT NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'HbA1c') IS NULL
    ALTER TABLE dbo.Admissions ADD HbA1c DECIMAL(4,2) NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'SystolicBP') IS NULL
    ALTER TABLE dbo.Admissions ADD SystolicBP INT NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'eGFR') IS NULL
    ALTER TABLE dbo.Admissions ADD eGFR DECIMAL(6,2) NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'AttendingPhysicianId') IS NULL
    ALTER TABLE dbo.Admissions ADD AttendingPhysicianId INT NULL;
GO

IF COL_LENGTH('dbo.Admissions', 'DischargeType') IS NULL
    ALTER TABLE dbo.Admissions ADD DischargeType NVARCHAR(100) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Admissions_AttendingPhysician'
      AND parent_object_id = OBJECT_ID('dbo.Admissions')
)
ALTER TABLE dbo.Admissions
ADD CONSTRAINT FK_Admissions_AttendingPhysician
FOREIGN KEY (AttendingPhysicianId) REFERENCES dbo.Users(UserId);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Admissions')
      AND name = 'CK_Admissions_SourceType'
)
ALTER TABLE dbo.Admissions
ADD CONSTRAINT CK_Admissions_SourceType
CHECK (SourceType IN (N'DATASET', N'DEMO'));
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Admissions')
      AND name = 'CK_Admissions_ClinicalRanges'
)
ALTER TABLE dbo.Admissions
ADD CONSTRAINT CK_Admissions_ClinicalRanges
CHECK (
    (PriorAdmissions IS NULL OR PriorAdmissions BETWEEN 0 AND 5)
    AND (MedicationsCount IS NULL OR MedicationsCount BETWEEN 0 AND 100)
    AND (ComorbiditiesCount IS NULL OR ComorbiditiesCount BETWEEN 0 AND 20)
    AND (HbA1c IS NULL OR HbA1c BETWEEN 0 AND 20)
    AND (SystolicBP IS NULL OR SystolicBP BETWEEN 0 AND 300)
    AND (eGFR IS NULL OR eGFR BETWEEN 0 AND 200)
);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Admissions')
      AND name = 'CK_Admissions_DischargeType'
)
ALTER TABLE dbo.Admissions
ADD CONSTRAINT CK_Admissions_DischargeType
CHECK (DischargeType IS NULL OR DischargeType IN (
    N'Home with Self-Care',
    N'Home Health Agency / Visiting Nurse',
    N'Skilled Nursing Facility (SNF)',
    N'Inpatient Rehabilitation Facility (IRF)',
    N'Left Against Medical Advice (AMA)',
    N'Hospice / Palliative Care'
));
GO

/* ================================================================
   5. PREDICTIONS - recommendation and model output
   Existing RiskScore uses probability scale 0 to 1.
   Frontend percentage = RiskScore * 100.
   ================================================================ */

IF COL_LENGTH('dbo.Predictions', 'RecommendedAction') IS NULL
    ALTER TABLE dbo.Predictions ADD RecommendedAction NVARCHAR(MAX) NULL;
GO

/* ================================================================
   6. RISK PREDICTION INPUTS - one input snapshot per prediction
   ================================================================ */

IF OBJECT_ID('dbo.RiskPredictionInputs', 'U') IS NULL
CREATE TABLE dbo.RiskPredictionInputs (
    PredictionId       BIGINT NOT NULL,
    PatientName        NVARCHAR(200) NULL,
    Age                INT NULL,
    Gender             NVARCHAR(20) NULL,
    PrimaryDiagnosis   NVARCHAR(200) NULL,
    PriorAdmissions    INT NULL,
    LengthOfStayDays   INT NULL,
    MedicationsCount   INT NULL,
    ChronicDiseases    NVARCHAR(MAX) NULL,
    DischargeType      NVARCHAR(100) NULL,
    CreatedAt          DATETIME2 NOT NULL
        CONSTRAINT DF_RiskPredictionInputs_CreatedAt
        DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_RiskPredictionInputs PRIMARY KEY (PredictionId),
    CONSTRAINT FK_RiskPredictionInputs_Predictions
        FOREIGN KEY (PredictionId) REFERENCES dbo.Predictions(PredictionId),

    CONSTRAINT CK_RiskPredictionInputs_Age
        CHECK (Age IS NULL OR Age BETWEEN 0 AND 120),

    CONSTRAINT CK_RiskPredictionInputs_ChronicDiseases
        CHECK (ChronicDiseases IS NULL OR ISJSON(ChronicDiseases) = 1)
);
GO

/* ================================================================
   7. FOLLOWUPS - MediSight scheduling fields
   ================================================================ */

IF COL_LENGTH('dbo.Followups', 'Priority') IS NULL
    ALTER TABLE dbo.Followups ADD Priority NVARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.Followups', 'Channel') IS NULL
    ALTER TABLE dbo.Followups ADD Channel NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.Followups', 'DueDate') IS NULL
    ALTER TABLE dbo.Followups ADD DueDate DATE NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Followups')
      AND name = 'CK_Followups_Status'
      AND definition NOT LIKE '%OVERDUE%'
)
    ALTER TABLE dbo.Followups DROP CONSTRAINT CK_Followups_Status;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Followups')
      AND name = 'CK_Followups_Status'
)
ALTER TABLE dbo.Followups
ADD CONSTRAINT CK_Followups_Status
CHECK (Status IN (
    N'SCHEDULED', N'PENDING CALL', N'OVERDUE',
    N'COMPLETED', N'MISSED', N'CANCELLED'
));
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Followups')
      AND name = 'CK_Followups_Priority'
)
ALTER TABLE dbo.Followups
ADD CONSTRAINT CK_Followups_Priority
CHECK (Priority IS NULL OR Priority IN (
    N'URGENT', N'MEDIUM', N'NORMAL'
));
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Followups')
      AND name = 'CK_Followups_Channel'
)
ALTER TABLE dbo.Followups
ADD CONSTRAINT CK_Followups_Channel
CHECK (Channel IS NULL OR Channel IN (
    N'7-Day In-Person Clinic Review',
    N'Telehealth Video Consultation',
    N'Nurse Navigator Outreach Call',
    N'Medication Reconciliation Review',
    N'Automated SMS Check-in'
));
GO

/* ================================================================
   8. NOTIFICATIONS - target navigation and category
   ================================================================ */

IF COL_LENGTH('dbo.Notifications', 'Category') IS NULL
    ALTER TABLE dbo.Notifications ADD Category NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'Title') IS NULL
    ALTER TABLE dbo.Notifications ADD Title NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'TargetPath') IS NULL
    ALTER TABLE dbo.Notifications ADD TargetPath NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.Notifications', 'TargetState') IS NULL
    ALTER TABLE dbo.Notifications ADD TargetState NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Notifications')
      AND name = 'CK_Notifications_Category'
)
ALTER TABLE dbo.Notifications
ADD CONSTRAINT CK_Notifications_Category
CHECK (Category IS NULL OR Category IN (
    N'high_risk', N'overdue', N'upload', N'scheduled'
));
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Notifications')
      AND name = 'CK_Notifications_TargetPath'
)
ALTER TABLE dbo.Notifications
ADD CONSTRAINT CK_Notifications_TargetPath
CHECK (TargetPath IS NULL OR TargetPath IN (
    N'/patients', N'/follow-ups', N'/data-upload'
));
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Notifications')
      AND name = 'CK_Notifications_TargetState'
)
ALTER TABLE dbo.Notifications
ADD CONSTRAINT CK_Notifications_TargetState
CHECK (TargetState IS NULL OR ISJSON(TargetState) = 1);
GO

/* ================================================================
   9. UPLOAD COLUMN AUDITS
   ================================================================ */

IF OBJECT_ID('dbo.UploadColumnAudits', 'U') IS NULL
CREATE TABLE dbo.UploadColumnAudits (
    AuditId       BIGINT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_UploadColumnAudits PRIMARY KEY,
    UploadId      BIGINT NOT NULL,
    ColumnName    NVARCHAR(128) NOT NULL,
    DataType      NVARCHAR(50) NULL,
    MissingBefore INT NOT NULL DEFAULT 0,
    MissingAfter  INT NOT NULL DEFAULT 0,
    Strategy      NVARCHAR(500) NULL,
    Status        NVARCHAR(20) NOT NULL,

    CONSTRAINT FK_UploadColumnAudits_Uploads
        FOREIGN KEY (UploadId) REFERENCES dbo.Uploads(UploadId),

    CONSTRAINT CK_UploadColumnAudits_Status
        CHECK (Status IN (N'CLEAN', N'RESOLVED')),

    CONSTRAINT CK_UploadColumnAudits_Missing
        CHECK (MissingBefore >= 0 AND MissingAfter >= 0)
);
GO

/* ================================================================
   10. REPORTING - monthly trend view
   Only records with actual discharge dates are included.
   Dataset rows with unavailable dates are not assigned fake dates.
   ================================================================ */

CREATE OR ALTER VIEW dbo.vw_MonthlyReadmissionTrends
AS
WITH LatestPrediction AS (
    SELECT
        AdmissionId,
        RiskScore,
        RiskLevel,
        ROW_NUMBER() OVER (
            PARTITION BY AdmissionId
            ORDER BY PredictedAt DESC, PredictionId DESC
        ) AS rn
    FROM dbo.Predictions
)
SELECT
    YEAR(a.DischargeDate) AS TrendYear,
    MONTH(a.DischargeDate) AS TrendMonth,
    LEFT(DATENAME(MONTH, a.DischargeDate), 3) AS MonthName,
    DATENAME(MONTH, a.DischargeDate) + N' '
        + CONVERT(NVARCHAR(4), YEAR(a.DischargeDate)) AS FullLabel,

    CAST(
        100.0 * SUM(CASE WHEN a.Readmitted30Days = 1 THEN 1 ELSE 0 END)
        / NULLIF(COUNT(a.Readmitted30Days), 0)
        AS DECIMAL(6,2)
    ) AS ObservedRate,

    CAST(100.0 * AVG(CAST(lp.RiskScore AS FLOAT)) AS DECIMAL(6,2))
        AS PredictedRate,

    COUNT(*) AS TotalDischarges,

    SUM(CASE WHEN lp.RiskLevel = N'HIGH' THEN 1 ELSE 0 END)
        AS HighRisk

FROM dbo.Admissions a
LEFT JOIN LatestPrediction lp
    ON lp.AdmissionId = a.AdmissionId AND lp.rn = 1

WHERE a.DischargeDate IS NOT NULL

GROUP BY
    YEAR(a.DischargeDate),
    MONTH(a.DischargeDate),
    DATENAME(MONTH, a.DischargeDate);
GO

PRINT N'MediSight hybrid database migration completed.';
GO
