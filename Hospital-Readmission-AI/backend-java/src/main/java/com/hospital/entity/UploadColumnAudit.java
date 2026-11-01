package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Entity
@Table(name = "upload_column_audits", indexes = {
        @Index(name = "idx_column_audit_upload", columnList = "upload_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadColumnAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "upload_id", nullable = false)
    private DataUpload dataUpload;

    @Column(name = "column_name", nullable = false)
    private String columnName;

    @Column(name = "column_type", nullable = false)
    private String columnType;

    @Column(name = "missing_before", nullable = false)
    @Builder.Default
    private int missingBefore = 0;

    @Column(name = "missing_after", nullable = false)
    @Builder.Default
    private int missingAfter = 0;

    @Column(columnDefinition = "TEXT")
    private String strategy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ColumnAuditStatus status;

    public enum ColumnAuditStatus {
        CLEAN, RESOLVED, REJECTED
    }
}