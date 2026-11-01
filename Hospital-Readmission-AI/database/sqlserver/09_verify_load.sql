/* SQL Server Express copy for .\SQLEXPRESS, generated from database/verify_load.sql.
   Run with: sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i 09_verify_load.sql
   Changes from the original: none. Read only. Run after the ETL load. */

/* =====================================================================
   Post-load verification - READ ONLY (only SELECT statements).
   Owner: Member 4 (ETL + Database)

   Run after `python main.py` has loaded diabetic_data.csv. The ETL performs
   the same checks automatically; this script lets anyone re-check by hand.
   Expected values for the full Diabetes 130-US Hospitals file are in the
   "expected" column.
   ===================================================================== */
USE HospitalReadmissionDB;
GO

/* 1. Row counts */
SELECT 'Patients (from dataset)'       AS check_name, COUNT(*) AS actual, 71518  AS expected
FROM dbo.Patients WHERE ExternalPatientId NOT LIKE N'SYN-%'
UNION ALL
SELECT 'Admissions (from dataset)',      COUNT(*), 101766 FROM dbo.Admissions WHERE ExternalAdmissionId IS NOT NULL
UNION ALL
SELECT 'AdmissionMedications (dataset)', COUNT(*), 101766
FROM dbo.AdmissionMedications m JOIN dbo.Admissions a ON a.AdmissionId = m.AdmissionId
WHERE a.ExternalAdmissionId IS NOT NULL
UNION ALL
SELECT 'AdmissionTypes',        COUNT(*), 8  FROM dbo.AdmissionTypes
UNION ALL
SELECT 'DischargeDispositions', COUNT(*), 30 FROM dbo.DischargeDispositions
UNION ALL
SELECT 'AdmissionSources',      COUNT(*), 25 FROM dbo.AdmissionSources;
GO

/* 2. Integrity: every count below must be 0 */
SELECT 'Admissions without medications row' AS check_name, COUNT(*) AS problems
FROM dbo.Admissions a
WHERE a.ExternalAdmissionId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.AdmissionMedications m WHERE m.AdmissionId = a.AdmissionId)
UNION ALL
SELECT 'Duplicate ExternalAdmissionId', COUNT(*) FROM (
    SELECT ExternalAdmissionId FROM dbo.Admissions WHERE ExternalAdmissionId IS NOT NULL
    GROUP BY ExternalAdmissionId HAVING COUNT(*) > 1) d
UNION ALL
SELECT 'Readmitted30Days inconsistent with ReadmissionStatus', COUNT(*) FROM dbo.Admissions
WHERE ReadmissionStatus IS NOT NULL
  AND (Readmitted30Days IS NULL OR Readmitted30Days <> CASE WHEN ReadmissionStatus = N'<30' THEN 1 ELSE 0 END)
UNION ALL
SELECT 'Admissions with invented dates', COUNT(*) FROM dbo.Admissions
WHERE ExternalAdmissionId IS NOT NULL AND (AdmissionDate IS NOT NULL OR DischargeDate IS NOT NULL)
UNION ALL
SELECT 'Patients with invented birth dates', COUNT(*) FROM dbo.Patients
WHERE ExternalPatientId NOT LIKE N'SYN-%' AND DateOfBirth IS NOT NULL;
GO

/* 3. Label distribution (expected NO 54864, >30 35545, <30 11357) */
SELECT ReadmissionStatus, COUNT(*) AS admissions
FROM dbo.Admissions WHERE ExternalAdmissionId IS NOT NULL
GROUP BY ReadmissionStatus ORDER BY ReadmissionStatus;
GO

/* 4. Flags (expected expired 1652, hospice 771, conflict patients 126) */
SELECT SUM(CAST(ExpiredAtDischarge  AS INT)) AS ExpiredAtDischarge,
       SUM(CAST(DischargedToHospice AS INT)) AS DischargedToHospice,
       (SELECT COUNT(*) FROM dbo.Patients WHERE HasDemographicConflict = 1) AS PatientsWithDemographicConflict
FROM dbo.Admissions WHERE ExternalAdmissionId IS NOT NULL;
GO

/* 5. Uploads and their data-quality findings */
SELECT * FROM dbo.vw_UploadQualitySummary ORDER BY UploadId DESC;
GO
