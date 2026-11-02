package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "upload_batches")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String filename;

    @Column(nullable = false)
    private LocalDateTime uploadTimestamp;

    @Column(nullable = false)
    private String uploadedBy;

    @Column(nullable = false)
    private int originalTotalRecords;

    private int successfullyProcessedRecords;
    private int missingValuesDetected;
    private int missingValuesHandled;
    private int duplicateRecordsDetected;
    private int duplicateRecordsRemoved;
    private int invalidRecordsDetected;
    private int invalidRecordsCorrected;
    private int unresolvedRecords;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BatchStatus status;

    public enum BatchStatus {
        PROCESSING, COMPLETED, FAILED
    }
}