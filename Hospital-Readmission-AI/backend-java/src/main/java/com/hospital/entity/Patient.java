package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "patients", indexes = {
        @Index(name = "idx_patient_display_id", columnList = "display_id", unique = true),
        @Index(name = "idx_patient_department", columnList = "department_id"),
        @Index(name = "idx_patient_physician", columnList = "attending_physician_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "display_id", unique = true, nullable = false)
    private String displayId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int age;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Gender gender;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @Column(name = "primary_diagnosis", nullable = false)
    private String primaryDiagnosis;

    @Column(name = "admission_date")
    private LocalDate admissionDate;

    @Column(name = "discharge_date")
    private LocalDate dischargeDate;

    @Column(name = "length_of_stay", nullable = false)
    private int lengthOfStay;

    @Column(name = "prior_admissions", nullable = false)
    private int priorAdmissions;

    @Column(name = "medications_count", nullable = false)
    private int medicationsCount;

    @Column(name = "comorbidities_count", nullable = false)
    private int comorbiditiesCount;

    @Column(precision = 6, scale = 2)
    private BigDecimal hba1c;

    @Column(name = "systolic_bp")
    private Integer systolicBp;

    @Column(precision = 6, scale = 2)
    private BigDecimal egfr;

    @Column(name = "risk_score", precision = 5, scale = 2)
    private BigDecimal riskScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level")
    private RiskLevel riskLevel; // Nullable until prediction

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "attending_physician_id", nullable = false)
    private User attendingPhysician; // Must have DOCTOR role

    @Enumerated(EnumType.STRING)
    @Column(name = "follow_up_status", nullable = false)
    @Builder.Default
    private FollowUpStatus followUpStatus = FollowUpStatus.PENDING_CALL;

    @Column(name = "next_follow_up")
    private LocalDate nextFollowUp;

    @Column(name = "observed_readmitted")
    private Boolean observedReadmitted;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum Gender {
        MALE, FEMALE, OTHER
    }

    public enum RiskLevel {
        LOW, MEDIUM, HIGH
    }

    public enum FollowUpStatus {
        PENDING_CALL, SCHEDULED, OVERDUE, COMPLETED
    }
}