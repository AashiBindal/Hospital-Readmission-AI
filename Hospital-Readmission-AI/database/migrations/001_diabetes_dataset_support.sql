/* =====================================================================
   Migration 001 - Diabetes 130-US Hospitals dataset support
   Owner: Member 4 (ETL + Database)

   WHEN TO USE
     ONLY for a database that was created with the ORIGINAL scaffold
     schema.sql (before the diabetes dataset was added). It upgrades those
     tables in place so diabetic_data_cleaned.csv (59 columns) can be stored.
     A NEW database does not need this file: run schema.sql instead.
     After this migration, run indexes.sql and views.sql.

   SAFETY
     * Non-destructive: no table is dropped, no row is deleted or updated.
     * Transactional: everything runs in ONE transaction. Any error rolls
       back every change (SET XACT_ABORT ON + TRY/CATCH).
     * Re-runnable: every step first checks whether it was already applied.
     * The only objects removed are the index IX_Admissions_AdmissionDate and
       the check constraint CK_Admissions_Dates, and only so AdmissionDate can
       become NULL-able. Both are re-created with identical definitions inside
       the same transaction. No data is touched.

   PREREQUISITES
     schema.sql, indexes.sql, views.sql, stored_procedures.sql already run.
     SQL Server 2016 SP1 or newer (CREATE OR ALTER).

   HOW TO RUN (review first!)
     sqlcmd -S localhost,1433 -U <user> -P <password> -I -i 001_diabetes_dataset_support.sql
     (-I turns QUOTED_IDENTIFIER ON, required for the filtered unique index.)
     Lookup tables are filled by the ETL from IDS_mapping.csv.
   ===================================================================== */

USE HospitalReadmissionDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    /* -----------------------------------------------------------------
       1. Lookup tables (original IDs and descriptions from IDS_mapping.csv)
       ----------------------------------------------------------------- */
    IF OBJECT_ID(N'dbo.AdmissionTypes', N'U') IS NULL
        EXEC(N'CREATE TABLE dbo.AdmissionTypes (
            AdmissionTypeId  INT            NOT NULL CONSTRAINT PK_AdmissionTypes PRIMARY KEY,
            Description      NVARCHAR(150)  NOT NULL,
            IsPlaceholder    BIT            NOT NULL CONSTRAINT DF_AdmissionTypes_IsPlaceholder DEFAULT 0
        );');

    IF OBJECT_ID(N'dbo.DischargeDispositions', N'U') IS NULL
        EXEC(N'CREATE TABLE dbo.DischargeDispositions (
            DischargeDispositionId  INT            NOT NULL CONSTRAINT PK_DischargeDispositions PRIMARY KEY,
            Description             NVARCHAR(150)  NOT NULL,
            IsPlaceholder           BIT            NOT NULL CONSTRAINT DF_DischargeDispositions_IsPlaceholder DEFAULT 0
        );');

    IF OBJECT_ID(N'dbo.AdmissionSources', N'U') IS NULL
        EXEC(N'CREATE TABLE dbo.AdmissionSources (
            AdmissionSourceId  INT            NOT NULL CONSTRAINT PK_AdmissionSources PRIMARY KEY,
            Description        NVARCHAR(150)  NOT NULL,
            IsPlaceholder      BIT            NOT NULL CONSTRAINT DF_AdmissionSources_IsPlaceholder DEFAULT 0
        );');

    /* -----------------------------------------------------------------
       2. Admissions.AdmissionDate -> NULL-able (source has no dates)
          SQL Server will not alter a column that an index or CHECK
          constraint depends on, so both are removed and re-created.
       ----------------------------------------------------------------- */
    IF EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'dbo.Admissions') AND name = N'AdmissionDate' AND is_nullable = 0)
    BEGIN
        DECLARE @hadIndex BIT = CASE WHEN EXISTS (SELECT 1 FROM sys.indexes
                                 WHERE object_id = OBJECT_ID(N'dbo.Admissions') AND name = N'IX_Admissions_AdmissionDate')
                                 THEN 1 ELSE 0 END;
        DECLARE @hadCheck BIT = CASE WHEN OBJECT_ID(N'dbo.CK_Admissions_Dates', N'C') IS NOT NULL THEN 1 ELSE 0 END;

        IF @hadIndex = 1 EXEC(N'DROP INDEX IX_Admissions_AdmissionDate ON dbo.Admissions;');
        IF @hadCheck = 1 EXEC(N'ALTER TABLE dbo.Admissions DROP CONSTRAINT CK_Admissions_Dates;');

        EXEC(N'ALTER TABLE dbo.Admissions ALTER COLUMN AdmissionDate DATETIME2 NULL;');

        IF @hadCheck = 1 EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_Dates
                                  CHECK (DischargeDate IS NULL OR DischargeDate >= AdmissionDate);');
        IF @hadIndex = 1 EXEC(N'CREATE INDEX IX_Admissions_AdmissionDate ON dbo.Admissions (AdmissionDate);');
    END

    /* -----------------------------------------------------------------
       3. Widen Admissions.DischargeDisposition 100 -> 150 characters
          (longest IDS_mapping description is 105). COL_LENGTH is in bytes.
       ----------------------------------------------------------------- */
    IF COL_LENGTH(N'dbo.Admissions', N'DischargeDisposition') < 300
        EXEC(N'ALTER TABLE dbo.Admissions ALTER COLUMN DischargeDisposition NVARCHAR(150) NULL;');

    /* -----------------------------------------------------------------
       4. New Admissions columns
       ----------------------------------------------------------------- */
    IF COL_LENGTH(N'dbo.Admissions', N'AgeGroup') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD AgeGroup NVARCHAR(10) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'RaceAtAdmission') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD RaceAtAdmission NVARCHAR(50) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'GenderAtAdmission') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD GenderAtAdmission NVARCHAR(20) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'WeightRange') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD WeightRange NVARCHAR(10) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'PayerCode') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD PayerCode NVARCHAR(10) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'AdmissionTypeId') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD AdmissionTypeId INT NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'DischargeDispositionId') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD DischargeDispositionId INT NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'AdmissionSourceId') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD AdmissionSourceId INT NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'AdmissionSource') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD AdmissionSource NVARCHAR(100) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'SecondaryDiagnosisCode') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD SecondaryDiagnosisCode NVARCHAR(20) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'TertiaryDiagnosisCode') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD TertiaryDiagnosisCode NVARCHAR(20) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'NumOutpatientVisits') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD NumOutpatientVisits INT NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'NumEmergencyVisits') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD NumEmergencyVisits INT NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'MaxGluSerum') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD MaxGluSerum NVARCHAR(10) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'A1CResult') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD A1CResult NVARCHAR(10) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'ReadmissionStatus') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD ReadmissionStatus NVARCHAR(5) NULL;');
    IF COL_LENGTH(N'dbo.Admissions', N'ExpiredAtDischarge') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD ExpiredAtDischarge BIT NOT NULL
                CONSTRAINT DF_Admissions_ExpiredAtDischarge DEFAULT 0;');
    IF COL_LENGTH(N'dbo.Admissions', N'DischargedToHospice') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD DischargedToHospice BIT NOT NULL
                CONSTRAINT DF_Admissions_DischargedToHospice DEFAULT 0;');

    /* -----------------------------------------------------------------
       5. Constraints on the new Admissions columns
       ----------------------------------------------------------------- */
    IF OBJECT_ID(N'dbo.FK_Admissions_AdmissionTypes', N'F') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT FK_Admissions_AdmissionTypes
                FOREIGN KEY (AdmissionTypeId) REFERENCES dbo.AdmissionTypes (AdmissionTypeId);');
    IF OBJECT_ID(N'dbo.FK_Admissions_DischargeDispositions', N'F') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT FK_Admissions_DischargeDispositions
                FOREIGN KEY (DischargeDispositionId) REFERENCES dbo.DischargeDispositions (DischargeDispositionId);');
    IF OBJECT_ID(N'dbo.FK_Admissions_AdmissionSources', N'F') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT FK_Admissions_AdmissionSources
                FOREIGN KEY (AdmissionSourceId) REFERENCES dbo.AdmissionSources (AdmissionSourceId);');

    IF OBJECT_ID(N'dbo.CK_Admissions_AgeGroup', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_AgeGroup CHECK (AgeGroup IN (
                N''[0-10)'', N''[10-20)'', N''[20-30)'', N''[30-40)'', N''[40-50)'',
                N''[50-60)'', N''[60-70)'', N''[70-80)'', N''[80-90)'', N''[90-100)''));');
    IF OBJECT_ID(N'dbo.CK_Admissions_RaceAtAdmission', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_RaceAtAdmission CHECK (RaceAtAdmission IN (
                N''Caucasian'', N''AfricanAmerican'', N''Hispanic'', N''Asian'', N''Other''));');
    IF OBJECT_ID(N'dbo.CK_Admissions_GenderAtAdmission', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_GenderAtAdmission CHECK (GenderAtAdmission IN (
                N''Female'', N''Male'', N''Unknown/Invalid''));');
    IF OBJECT_ID(N'dbo.CK_Admissions_MaxGluSerum', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_MaxGluSerum CHECK (MaxGluSerum IN (
                N''NotTested'', N''Norm'', N''>200'', N''>300''));');
    IF OBJECT_ID(N'dbo.CK_Admissions_A1CResult', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_A1CResult CHECK (A1CResult IN (
                N''NotTested'', N''Norm'', N''>7'', N''>8''));');
    IF OBJECT_ID(N'dbo.CK_Admissions_ReadmissionStatus', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_ReadmissionStatus CHECK (ReadmissionStatus IN (
                N''NO'', N''>30'', N''<30''));');
    IF OBJECT_ID(N'dbo.CK_Admissions_Readmitted30Days', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_Readmitted30Days CHECK (
                ReadmissionStatus IS NULL OR (Readmitted30Days IS NOT NULL AND
                Readmitted30Days = CASE WHEN ReadmissionStatus = N''<30'' THEN 1 ELSE 0 END));');
    IF OBJECT_ID(N'dbo.CK_Admissions_ExpiredAtDischarge', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_ExpiredAtDischarge CHECK (
                ExpiredAtDischarge = CASE WHEN DischargeDispositionId IN (11, 19, 20, 21) THEN 1 ELSE 0 END);');
    IF OBJECT_ID(N'dbo.CK_Admissions_DischargedToHospice', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_DischargedToHospice CHECK (
                DischargedToHospice = CASE WHEN DischargeDispositionId IN (13, 14) THEN 1 ELSE 0 END);');
    IF OBJECT_ID(N'dbo.CK_Admissions_NewCounts', N'C') IS NULL
        EXEC(N'ALTER TABLE dbo.Admissions ADD CONSTRAINT CK_Admissions_NewCounts CHECK (
                (NumOutpatientVisits IS NULL OR NumOutpatientVisits >= 0) AND
                (NumEmergencyVisits IS NULL OR NumEmergencyVisits >= 0));');

    /* One row per source encounter; filtered so older rows without an
       ExternalAdmissionId (e.g. sample_data.sql) remain allowed. */
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE object_id = OBJECT_ID(N'dbo.Admissions') AND name = N'UX_Admissions_ExternalAdmissionId')
        EXEC(N'CREATE UNIQUE INDEX UX_Admissions_ExternalAdmissionId ON dbo.Admissions (ExternalAdmissionId)
                WHERE ExternalAdmissionId IS NOT NULL;');

    /* -----------------------------------------------------------------
       6. Patients: flag for race/gender disagreement between stays
       ----------------------------------------------------------------- */
    IF COL_LENGTH(N'dbo.Patients', N'HasDemographicConflict') IS NULL
        EXEC(N'ALTER TABLE dbo.Patients ADD HasDemographicConflict BIT NOT NULL
                CONSTRAINT DF_Patients_HasDemographicConflict DEFAULT 0;');

    /* -----------------------------------------------------------------
       7. AdmissionMedications: 1:1 with Admissions
       ----------------------------------------------------------------- */
    IF OBJECT_ID(N'dbo.AdmissionMedications', N'U') IS NULL
        EXEC(N'CREATE TABLE dbo.AdmissionMedications (
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
            CONSTRAINT FK_AdmissionMedications_Admissions FOREIGN KEY (AdmissionId)
                REFERENCES dbo.Admissions (AdmissionId),
            CONSTRAINT CK_AdmissionMedications_Values CHECK (
                Metformin               IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Repaglinide             IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Nateglinide             IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Chlorpropamide          IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Glimepiride             IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Acetohexamide           IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Glipizide               IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Glyburide               IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Tolbutamide             IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Pioglitazone            IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Rosiglitazone           IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Acarbose                IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Miglitol                IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Troglitazone            IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Tolazamide              IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Examide                 IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Citoglipton             IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                Insulin                 IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                GlyburideMetformin      IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                GlipizideMetformin      IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                GlimepiridePioglitazone IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                MetforminRosiglitazone  IN (N''No'', N''Steady'', N''Up'', N''Down'') AND
                MetforminPioglitazone   IN (N''No'', N''Steady'', N''Up'', N''Down''))
        );');

    COMMIT TRANSACTION;
    PRINT N'Migration 001 applied successfully.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT N'Migration 001 FAILED and was rolled back. No changes were made.';
    THROW;
END CATCH;
GO
