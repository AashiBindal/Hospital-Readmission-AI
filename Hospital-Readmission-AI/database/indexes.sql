/* =====================================================================
   Indexes - safe to re-run (each index is created only if missing).
   Owner: Member 4 (ETL + Database)
   Run after schema.sql (or after migrations/001 on an older database).
   The unique index UX_Admissions_ExternalAdmissionId is part of schema.sql
   because the ETL relies on it to prevent duplicate admissions.
   ===================================================================== */
USE HospitalReadmissionDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_PatientId' AND object_id = OBJECT_ID(N'dbo.Admissions'))
    CREATE INDEX IX_Admissions_PatientId ON dbo.Admissions (PatientId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_AdmissionDate' AND object_id = OBJECT_ID(N'dbo.Admissions'))
    CREATE INDEX IX_Admissions_AdmissionDate ON dbo.Admissions (AdmissionDate);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_UploadId' AND object_id = OBJECT_ID(N'dbo.Admissions'))
    CREATE INDEX IX_Admissions_UploadId ON dbo.Admissions (UploadId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_ReadmissionStatus' AND object_id = OBJECT_ID(N'dbo.Admissions'))
    CREATE INDEX IX_Admissions_ReadmissionStatus ON dbo.Admissions (ReadmissionStatus)
        INCLUDE (ExpiredAtDischarge, DischargedToHospice);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_AdmissionTypeId' AND object_id = OBJECT_ID(N'dbo.Admissions'))
    CREATE INDEX IX_Admissions_AdmissionTypeId ON dbo.Admissions (AdmissionTypeId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_DischargeDispositionId' AND object_id = OBJECT_ID(N'dbo.Admissions'))
    CREATE INDEX IX_Admissions_DischargeDispositionId ON dbo.Admissions (DischargeDispositionId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Admissions_AdmissionSourceId' AND object_id = OBJECT_ID(N'dbo.Admissions'))
    CREATE INDEX IX_Admissions_AdmissionSourceId ON dbo.Admissions (AdmissionSourceId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Predictions_AdmissionId' AND object_id = OBJECT_ID(N'dbo.Predictions'))
    CREATE INDEX IX_Predictions_AdmissionId ON dbo.Predictions (AdmissionId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Predictions_RiskLevel' AND object_id = OBJECT_ID(N'dbo.Predictions'))
    CREATE INDEX IX_Predictions_RiskLevel ON dbo.Predictions (RiskLevel) INCLUDE (RiskScore, PredictedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Followups_PatientId' AND object_id = OBJECT_ID(N'dbo.Followups'))
    CREATE INDEX IX_Followups_PatientId ON dbo.Followups (PatientId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Followups_Status_Date' AND object_id = OBJECT_ID(N'dbo.Followups'))
    CREATE INDEX IX_Followups_Status_Date ON dbo.Followups (Status, ScheduledDate);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DataQualityLogs_UploadId' AND object_id = OBJECT_ID(N'dbo.DataQualityLogs'))
    CREATE INDEX IX_DataQualityLogs_UploadId ON dbo.DataQualityLogs (UploadId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notifications_User_Unread' AND object_id = OBJECT_ID(N'dbo.Notifications'))
    CREATE INDEX IX_Notifications_User_Unread ON dbo.Notifications (UserId, IsRead);
GO
