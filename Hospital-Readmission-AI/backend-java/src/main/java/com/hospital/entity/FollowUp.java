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
@Table(name = "follow_ups", indexes = {
        @Index(name = "idx_follow_up_display_id", columnList = "display_id", unique = true),
        @Index(name = "idx_follow_up_patient", columnList = "patient_id"),
        @Index(name = "idx_follow_up_assigned", columnList = "assigned_to_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FollowUp {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "display_id", unique = true, nullable = false)
    private String displayId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "risk_prediction_id", nullable = true)
    private RiskPrediction riskPrediction;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level")
    private RiskPrediction.RiskLevel riskLevel; // Fixed: Entity ki jagah RiskPrediction.RiskLevel enum type kar diya gaya hai

    @Column(name = "risk_score", precision = 5, scale = 2)
    private BigDecimal riskScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assigned_to_id", nullable = false)
    private User assignedTo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Channel channel;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.SCHEDULED;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

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

    public enum Priority {
        URGENT, MEDIUM, NORMAL
    }

    public enum Channel {
        IN_PERSON_CLINIC_REVIEW,
        TELEHEALTH,
        NURSE_OUTREACH,
        MEDICATION_RECONCILIATION,
        SMS_CHECK_IN
    }

    public enum Status {
        PENDING_CALL,
        SCHEDULED,
        OVERDUE,
        COMPLETED
    }
}