/* SQL Server Express copy for .\SQLEXPRESS, generated from database/views.sql.
   Run with: sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i 03_views.sql
   Changes from the original: explicit SET options added, because sqlcmd without -I would store these
   objects with QUOTED_IDENTIFIER OFF. */

/* =====================================================================
   Reporting and integration views (CREATE OR ALTER - safe to re-run).
   Owner: Member 4 (ETL + Database)
   Run after schema.sql + indexes.sql (or after migrations/001).
   ===================================================================== */
USE HospitalReadmissionDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* Latest prediction per admission with patient context.
   The first 13 columns are unchanged from the original view; the last three
   were added for the diabetes dataset (AdmissionDate/DischargeDate are NULL
   because the source has no dates). */
CREATE OR ALTER VIEW dbo.vw_LatestPredictions AS
SELECT  a.AdmissionId, a.PatientId, p.ExternalPatientId, p.Gender, p.Age,
        a.AdmissionDate, a.DischargeDate, a.Department,
        pr.PredictionId, pr.RiskScore, pr.RiskLevel, pr.ModelVersion, pr.PredictedAt,
        a.AgeGroup, a.ReadmissionStatus, a.ExpiredAtDischarge
FROM dbo.Admissions a
JOIN dbo.Patients p ON p.PatientId = a.PatientId
CROSS APPLY (
    SELECT TOP 1 * FROM dbo.Predictions x
    WHERE x.AdmissionId = a.AdmissionId
    ORDER BY x.PredictedAt DESC
) pr;
GO

/* Dashboard counts by risk level */
CREATE OR ALTER VIEW dbo.vw_RiskSummary AS
SELECT RiskLevel, COUNT(*) AS AdmissionCount, AVG(CAST(RiskScore AS FLOAT)) AS AvgRiskScore
FROM dbo.vw_LatestPredictions
GROUP BY RiskLevel;
GO

/* Data quality summary per upload */
CREATE OR ALTER VIEW dbo.vw_UploadQualitySummary AS
SELECT u.UploadId, u.FileName, u.Status, u.TotalRows, u.ValidRows, u.RejectedRows, u.UploadedAt,
       SUM(CASE WHEN d.Severity = N'ERROR'   THEN 1 ELSE 0 END) AS ErrorCount,
       SUM(CASE WHEN d.Severity = N'WARNING' THEN 1 ELSE 0 END) AS WarningCount
FROM dbo.Uploads u
LEFT JOIN dbo.DataQualityLogs d ON d.UploadId = u.UploadId
GROUP BY u.UploadId, u.FileName, u.Status, u.TotalRows, u.ValidRows, u.RejectedRows, u.UploadedAt;
GO

/* One row per admission with every cleaned feature, the labels and the
   training flags - the integration point for the ML team (read-only).
   Training guidance: exclude ExpiredAtDischarge = 1 (cannot be readmitted);
   decide separately about DischargedToHospice = 1; split train/test by
   ExternalPatientId because many patients have several admissions. */
CREATE OR ALTER VIEW dbo.vw_AdmissionFeatures AS
SELECT  a.AdmissionId, a.ExternalAdmissionId, a.PatientId, p.ExternalPatientId,
        a.AgeGroup, a.RaceAtAdmission, a.GenderAtAdmission, a.WeightRange, a.PayerCode,
        a.AdmissionTypeId, a.AdmissionType, a.DischargeDispositionId, a.DischargeDisposition,
        a.AdmissionSourceId, a.AdmissionSource, a.Department,
        a.LengthOfStayDays, a.NumLabTests, a.NumProcedures, a.NumMedications,
        a.NumOutpatientVisits, a.NumEmergencyVisits, a.NumPriorAdmissions, a.NumDiagnoses,
        a.PrimaryDiagnosisCode, a.SecondaryDiagnosisCode, a.TertiaryDiagnosisCode,
        a.MaxGluSerum, a.A1CResult,
        m.Metformin, m.Repaglinide, m.Nateglinide, m.Chlorpropamide, m.Glimepiride,
        m.Acetohexamide, m.Glipizide, m.Glyburide, m.Tolbutamide, m.Pioglitazone,
        m.Rosiglitazone, m.Acarbose, m.Miglitol, m.Troglitazone, m.Tolazamide,
        m.Examide, m.Citoglipton, m.Insulin, m.GlyburideMetformin, m.GlipizideMetformin,
        m.GlimepiridePioglitazone, m.MetforminRosiglitazone, m.MetforminPioglitazone,
        m.MedicationChanged, m.DiabetesMedPrescribed,
        a.ReadmissionStatus, a.Readmitted30Days,
        a.ExpiredAtDischarge, a.DischargedToHospice,
        CAST(CASE WHEN a.ExpiredAtDischarge = 0 AND a.ReadmissionStatus IS NOT NULL
                  THEN 1 ELSE 0 END AS BIT) AS EligibleForTraining,
        a.UploadId
FROM dbo.Admissions a
JOIN dbo.Patients p              ON p.PatientId   = a.PatientId
JOIN dbo.AdmissionMedications m  ON m.AdmissionId = a.AdmissionId;
GO
