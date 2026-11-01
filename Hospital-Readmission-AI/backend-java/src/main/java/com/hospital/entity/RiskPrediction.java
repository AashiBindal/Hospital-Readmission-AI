package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "risk_predictions", indexes = {
        @Index(name = "idx_risk_pred_patient", columnList = "patient_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = true)
    private Patient patient; // Nullable for standalone prediction

    @Column(name = "patient_name", nullable = false)
    private String patientName;

    @Column(nullable = false)
    private int age;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Gender gender;

    @Column(name = "primary_diagnosis", nullable = false)
    private String primaryDiagnosis;

    @Column(name = "prior_admissions", nullable = false)
    private int priorAdmissions;

    @Column(name = "length_of_stay", nullable = false)
    private int lengthOfStay;

    @Column(name = "medications_count", nullable = false)
    private int medicationsCount;

    @Column(name = "chronic_diseases", columnDefinition = "jsonb")
    private String chronicDiseases;

    @Enumerated(EnumType.STRING)
    @Column(name = "discharge_type", nullable = false)
    private DischargeType dischargeType;

    @Column(precision = 5, scale = 2, nullable = false)
    private BigDecimal probability;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false)
    private RiskLevel riskLevel;

    @Column(name = "recommended_action", columnDefinition = "TEXT")
    private String recommendedAction;

    @Column(name = "model_version", nullable = false)
    private String modelVersion;

    @Column(name = "predicted_at", nullable = false)
    private LocalDateTime predictedAt;

    @Column(name = "input_snapshot", columnDefinition = "jsonb")
    private String inputSnapshot;

    @OneToMany(mappedBy = "riskPrediction", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PredictionFactor> factors;

    @PrePersist
    public void prePersist() {
        if (this.predictedAt == null) {
            this.predictedAt = LocalDateTime.now();
        }
    }

    public enum Gender {
        MALE, FEMALE, OTHER
    }

    public enum DischargeType {
        HOME_SELF_CARE, HOME_HEALTH, SNF, IRF, AMA, HOSPICE
    }

    public enum RiskLevel {
        LOW, MEDIUM, HIGH
    }
}