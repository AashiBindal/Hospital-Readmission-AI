package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "data_uploads", indexes = {
        @Index(name = "idx_data_upload_display_id", columnList = "display_id", unique = true),
        @Index(name = "idx_data_upload_user", columnList = "uploaded_by_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataUpload {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "display_id", unique = true, nullable = false)
    private String displayId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "uploaded_by_id", nullable = false)
    private User uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    @Column(name = "records_count", nullable = false)
    @Builder.Default
    private int recordsCount = 0;

    @Column(name = "high_risk_found", nullable = false)
    @Builder.Default
    private int highRiskFound = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UploadStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "file_type", nullable = false)
    private UploadFileType fileType;

    @OneToMany(mappedBy = "dataUpload", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<UploadColumnAudit> columnAudits;

    @PrePersist
    public void prePersist() {
        if (this.uploadedAt == null) {
            this.uploadedAt = LocalDateTime.now();
        }
    }

    public enum UploadStatus {
        PROCESSING, VALIDATED, FAILED
    }

    public enum UploadFileType {
        CSV, XLS, XLSX
    }
}