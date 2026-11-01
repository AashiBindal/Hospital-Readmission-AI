/* Reporting views (starter). Owner: Member 4 */
USE HospitalReadmissionDB;
GO

/* Latest prediction per admission with patient context */
CREATE OR ALTER VIEW dbo.vw_LatestPredictions AS
SELECT  a.AdmissionId, a.PatientId, p.ExternalPatientId, p.Gender, p.Age,
        a.AdmissionDate, a.DischargeDate, a.Department,
        pr.PredictionId, pr.RiskScore, pr.RiskLevel, pr.ModelVersion, pr.PredictedAt
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
