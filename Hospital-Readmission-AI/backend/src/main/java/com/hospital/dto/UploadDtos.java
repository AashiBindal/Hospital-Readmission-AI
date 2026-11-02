package com.hospital.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class UploadDtos {

    private UploadDtos() {
    }

    /** status: Pending | Processing | Completed | Failed */
    public record UploadRow(String id, String fileName, Long fileSizeBytes, String uploadedBy, String role,
                            LocalDateTime date, String status, Integer recordsCount, Integer loadedCount,
                            Integer rejectedCount, long highRiskFound, String errorMessage,
                            LocalDateTime processedAt) {
    }

    public record UploadAccepted(String uploadId, String id, String status, boolean etlStarted, String message) {
    }

    public record QualityIssue(String rule, String column, String severity, int affectedRows, String details) {
    }

    public record QualityReport(String uploadId, String fileName, String status, String errorMessage,
                                Integer totalRecords, Integer cleanRecords, Integer rejectedRecords,
                                int errorCount, int warningCount, int infoCount,
                                long errorRows, long warningRows, List<QualityIssue> issues) {
    }
}
