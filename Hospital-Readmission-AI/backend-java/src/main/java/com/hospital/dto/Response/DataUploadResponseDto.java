package com.hospital.dto.Response;

import com.hospital.entity.UploadColumnAudit;
import com.hospital.entity.DataUpload;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DataUploadResponseDto {
    private UUID id;
    private String displayId;
    private String fileName;
    private String uploadedByName;
    private LocalDateTime uploadedAt;
    private int recordsCount;
    private int highRiskFound;
    private DataUpload.UploadStatus status;
    private DataUpload.UploadFileType fileType;
    private List<ColumnAuditDto> columnAudits;

    @Data
    @Builder
    public static class ColumnAuditDto {
        private String columnName;
        private String columnType;
        private int missingBefore;
        private int missingAfter;
        private String strategy;
        private UploadColumnAudit.ColumnAuditStatus status;
    }
}