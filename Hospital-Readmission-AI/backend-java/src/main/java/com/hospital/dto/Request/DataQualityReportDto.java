package com.hospital.dto.Request;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DataQualityReportDto {
    private Long batchId;
    private String filename;
    private int originalTotalRecords;
    private int successfullyProcessedRecords;
    private int missingValuesDetected;
    private int missingValuesHandled;
    private int duplicateRecordsDetected;
    private int duplicateRecordsRemoved;
    private int invalidRecordsDetected;
    private int invalidRecordsCorrected;
    private int unresolvedRecords;
    private String status;
    private String message;
}