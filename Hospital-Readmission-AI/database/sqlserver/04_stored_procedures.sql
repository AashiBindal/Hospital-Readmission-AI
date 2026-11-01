/* SQL Server Express copy for .\SQLEXPRESS, generated from database/stored_procedures.sql.
   Run with: sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i 04_stored_procedures.sql
   Changes from the original: explicit SET options added, because sqlcmd without -I would store these
   objects with QUOTED_IDENTIFIER OFF. */

/* Stored procedures (placeholders). Owner: Member 4 */
USE HospitalReadmissionDB;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* Returns high-risk patients for the follow-up worklist. */
CREATE OR ALTER PROCEDURE dbo.usp_GetHighRiskPatients
    @MinScore DECIMAL(5,4) = 0.6
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.vw_LatestPredictions
    WHERE RiskScore >= @MinScore
    ORDER BY RiskScore DESC;
END;
GO

/* Marks an upload as finished and stores row counts. */
CREATE OR ALTER PROCEDURE dbo.usp_CompleteUpload
    @UploadId BIGINT, @TotalRows INT, @ValidRows INT, @RejectedRows INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Uploads
       SET Status = N'COMPLETED', TotalRows = @TotalRows, ValidRows = @ValidRows,
           RejectedRows = @RejectedRows, ProcessedAt = SYSUTCDATETIME()
     WHERE UploadId = @UploadId;
END;
GO

/* TODO (Member 4): usp_InsertPrediction, usp_GetDashboardMetrics, ... */
