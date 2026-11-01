/* Read-only check that every required object exists.
   Run with: sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i 08_verify_schema.sql
   Each result set lists what is MISSING and must be empty. The script ends with
   an error if anything is missing, so sqlcmd -b returns a non-zero exit code. */
USE HospitalReadmissionDB;
GO

SET NOCOUNT ON;

DECLARE @Required TABLE (Kind NVARCHAR(20), Name SYSNAME, Parent SYSNAME NULL);

INSERT INTO @Required (Kind, Name) VALUES
 (N'TABLE', N'Users'), (N'TABLE', N'Patients'), (N'TABLE', N'Uploads'),
 (N'TABLE', N'AdmissionTypes'), (N'TABLE', N'DischargeDispositions'), (N'TABLE', N'AdmissionSources'),
 (N'TABLE', N'Admissions'), (N'TABLE', N'AdmissionMedications'), (N'TABLE', N'Predictions'),
 (N'TABLE', N'Followups'), (N'TABLE', N'DataQualityLogs'), (N'TABLE', N'Notifications'),
 (N'TABLE', N'RiskPredictionInputs'), (N'TABLE', N'UploadColumnAudits'),
 (N'VIEW', N'vw_LatestPredictions'), (N'VIEW', N'vw_RiskSummary'), (N'VIEW', N'vw_UploadQualitySummary'),
 (N'VIEW', N'vw_AdmissionFeatures'), (N'VIEW', N'vw_MonthlyReadmissionTrends'),
 (N'PROCEDURE', N'usp_GetHighRiskPatients'), (N'PROCEDURE', N'usp_CompleteUpload'),
 (N'FK', N'FK_Uploads_Users'), (N'FK', N'FK_Admissions_Patients'), (N'FK', N'FK_Admissions_Uploads'),
 (N'FK', N'FK_Admissions_AdmissionTypes'), (N'FK', N'FK_Admissions_DischargeDispositions'),
 (N'FK', N'FK_Admissions_AdmissionSources'), (N'FK', N'FK_Admissions_AttendingPhysician'),
 (N'FK', N'FK_AdmissionMedications_Admissions'), (N'FK', N'FK_Predictions_Admissions'),
 (N'FK', N'FK_Followups_Patients'), (N'FK', N'FK_Followups_Predictions'), (N'FK', N'FK_Followups_Users'),
 (N'FK', N'FK_DataQualityLogs_Uploads'), (N'FK', N'FK_Notifications_Users'), (N'FK', N'FK_Notifications_Patients'),
 (N'FK', N'FK_RiskPredictionInputs_Predictions'), (N'FK', N'FK_UploadColumnAudits_Uploads');

INSERT INTO @Required (Kind, Parent, Name) VALUES
 (N'INDEX', N'Admissions', N'UX_Admissions_ExternalAdmissionId'),
 (N'INDEX', N'Admissions', N'IX_Admissions_PatientId'),
 (N'INDEX', N'Admissions', N'IX_Admissions_AdmissionDate'),
 (N'INDEX', N'Admissions', N'IX_Admissions_UploadId'),
 (N'INDEX', N'Admissions', N'IX_Admissions_ReadmissionStatus'),
 (N'INDEX', N'Admissions', N'IX_Admissions_AdmissionTypeId'),
 (N'INDEX', N'Admissions', N'IX_Admissions_DischargeDispositionId'),
 (N'INDEX', N'Admissions', N'IX_Admissions_AdmissionSourceId'),
 (N'INDEX', N'Patients', N'UX_Patients_PatientCode'),
 (N'INDEX', N'Predictions', N'IX_Predictions_AdmissionId'),
 (N'INDEX', N'Predictions', N'IX_Predictions_RiskLevel'),
 (N'INDEX', N'Followups', N'IX_Followups_PatientId'),
 (N'INDEX', N'Followups', N'IX_Followups_Status_Date'),
 (N'INDEX', N'DataQualityLogs', N'IX_DataQualityLogs_UploadId'),
 (N'INDEX', N'Notifications', N'IX_Notifications_User_Unread');

/* 1. Missing objects (must be empty) */
DECLARE @Missing TABLE (Kind NVARCHAR(30), Name SYSNAME);

INSERT INTO @Missing
SELECT r.Kind, r.Name FROM @Required r
WHERE (r.Kind = N'TABLE'     AND OBJECT_ID(N'dbo.' + r.Name, N'U') IS NULL)
   OR (r.Kind = N'VIEW'      AND OBJECT_ID(N'dbo.' + r.Name, N'V') IS NULL)
   OR (r.Kind = N'PROCEDURE' AND OBJECT_ID(N'dbo.' + r.Name, N'P') IS NULL)
   OR (r.Kind = N'FK'        AND OBJECT_ID(N'dbo.' + r.Name, N'F') IS NULL)
   OR (r.Kind = N'INDEX'     AND NOT EXISTS (SELECT 1 FROM sys.indexes i
                                             WHERE i.object_id = OBJECT_ID(N'dbo.' + r.Parent) AND i.name = r.Name));

/* 2. Tables without a primary key, disabled or untrusted foreign keys,
      and modules stored with the wrong SET options */
INSERT INTO @Missing
SELECT N'TABLE WITHOUT PK', t.name FROM sys.tables t
WHERE t.is_ms_shipped = 0 AND OBJECTPROPERTY(t.object_id, 'TableHasPrimaryKey') = 0
UNION ALL
SELECT N'FK DISABLED OR UNTRUSTED', name FROM sys.foreign_keys WHERE is_disabled = 1 OR is_not_trusted = 1
UNION ALL
SELECT N'MODULE SET OPTIONS', OBJECT_NAME(object_id) FROM sys.sql_modules
WHERE uses_quoted_identifier = 0 OR uses_ansi_nulls = 0;

SELECT Kind AS problem_kind, Name AS problem_object FROM @Missing ORDER BY Kind, Name;

/* 3. Summary */
SELECT Kind AS object_kind, COUNT(*) AS required_count FROM @Required GROUP BY Kind ORDER BY Kind;

SELECT 'Tables' AS object_kind, COUNT(*) AS found FROM sys.tables WHERE is_ms_shipped = 0
UNION ALL SELECT 'Primary keys', COUNT(*) FROM sys.key_constraints WHERE type = 'PK'
UNION ALL SELECT 'Foreign keys', COUNT(*) FROM sys.foreign_keys
UNION ALL SELECT 'Check constraints', COUNT(*) FROM sys.check_constraints
UNION ALL SELECT 'Non-PK indexes', COUNT(*) FROM sys.indexes i
          JOIN sys.tables t ON t.object_id = i.object_id
          WHERE t.is_ms_shipped = 0 AND i.is_primary_key = 0 AND i.type > 0
UNION ALL SELECT 'Views', COUNT(*) FROM sys.views WHERE is_ms_shipped = 0
UNION ALL SELECT 'Stored procedures', COUNT(*) FROM sys.procedures WHERE is_ms_shipped = 0;

IF EXISTS (SELECT 1 FROM @Missing)
    THROW 50001, N'Schema verification FAILED: see the list of problems above.', 1;

PRINT N'Schema verification passed.';
GO
