/* =====================================================================
   SYNTHETIC sample data for local development ONLY.
   Contains NO real patient information. Password hash below is a
   placeholder and will not authenticate.
   ===================================================================== */
USE HospitalReadmissionDB;
GO

/* Safety guard: these inserts assume an EMPTY database (PatientId 1-3,
   AdmissionId 1-3). Never mix synthetic rows with the real dataset. */
IF EXISTS (SELECT 1 FROM dbo.Patients) OR EXISTS (SELECT 1 FROM dbo.Admissions)
BEGIN
    RAISERROR(N'sample_data.sql skipped: the database already contains data.', 16, 1);
    SET NOEXEC ON;   -- skip the remaining batches of this script
END
GO

INSERT INTO dbo.Users (Username, Email, PasswordHash, FullName, Role) VALUES
 (N'admin',   N'admin@example.com',   N'$2a$10$PLACEHOLDER_HASH_REPLACE_ME', N'Demo Admin',   N'ADMIN'),
 (N'dr.demo', N'doctor@example.com',  N'$2a$10$PLACEHOLDER_HASH_REPLACE_ME', N'Demo Doctor',  N'DOCTOR');

INSERT INTO dbo.Patients (ExternalPatientId, Gender, Age, InsuranceType) VALUES
 (N'SYN-0001', N'Female', 67, N'Public'),
 (N'SYN-0002', N'Male',   54, N'Private'),
 (N'SYN-0003', N'Female', 81, N'Public');

INSERT INTO dbo.Uploads (FileName, UploadedBy, Status, TotalRows, ValidRows, RejectedRows, ProcessedAt) VALUES
 (N'sample_admissions.csv', 1, N'COMPLETED', 3, 3, 0, SYSUTCDATETIME());

INSERT INTO dbo.Admissions (PatientId, UploadId, AdmissionDate, DischargeDate, LengthOfStayDays, AdmissionType,
                            Department, PrimaryDiagnosisCode, NumDiagnoses, NumMedications, NumPriorAdmissions) VALUES
 (1, 1, '2026-01-03', '2026-01-09', 6, N'Emergency', N'Cardiology', N'I50.9', 7, 14, 2),
 (2, 1, '2026-01-10', '2026-01-12', 2, N'Elective',  N'Orthopedics', N'M17.11', 3, 5, 0),
 (3, 1, '2026-01-15', '2026-01-25', 10, N'Emergency', N'Pulmonology', N'J44.1', 9, 18, 4);

INSERT INTO dbo.Predictions (AdmissionId, RiskScore, RiskLevel, ModelVersion) VALUES
 (1, 0.6200, N'HIGH',   N'0.0.0-synthetic'),
 (2, 0.1200, N'LOW',    N'0.0.0-synthetic'),
 (3, 0.4500, N'MEDIUM', N'0.0.0-synthetic');

INSERT INTO dbo.Followups (PatientId, PredictionId, AssignedTo, FollowupType, ScheduledDate) VALUES
 (1, 1, 2, N'CALL', '2026-01-16');

INSERT INTO dbo.DataQualityLogs (UploadId, RuleName, ColumnName, Severity, AffectedRows, Details) VALUES
 (1, N'missing_values', N'DischargeDisposition', N'WARNING', 3, N'Column empty in all rows');

INSERT INTO dbo.Notifications (UserId, PatientId, Type, Message) VALUES
 (2, 1, N'HIGH_RISK', N'Patient SYN-0001 flagged as HIGH readmission risk.');
GO

SET NOEXEC OFF;
GO
