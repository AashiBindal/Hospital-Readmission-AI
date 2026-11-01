/* Initial indexes — refine after query patterns are known. Owner: Member 4 */
USE HospitalReadmissionDB;
GO

CREATE INDEX IX_Admissions_PatientId      ON dbo.Admissions (PatientId);
CREATE INDEX IX_Admissions_AdmissionDate  ON dbo.Admissions (AdmissionDate);
CREATE INDEX IX_Admissions_UploadId       ON dbo.Admissions (UploadId);
CREATE INDEX IX_Predictions_AdmissionId   ON dbo.Predictions (AdmissionId);
CREATE INDEX IX_Predictions_RiskLevel     ON dbo.Predictions (RiskLevel) INCLUDE (RiskScore, PredictedAt);
CREATE INDEX IX_Followups_PatientId       ON dbo.Followups (PatientId);
CREATE INDEX IX_Followups_Status_Date     ON dbo.Followups (Status, ScheduledDate);
CREATE INDEX IX_DataQualityLogs_UploadId  ON dbo.DataQualityLogs (UploadId);
CREATE INDEX IX_Notifications_User_Unread ON dbo.Notifications (UserId, IsRead);
GO
