package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "prediction_histories")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String patientId;

    @Column(nullable = false)
    private String modelVersion;

    @Column(nullable = false)
    private double riskProbability; // e.g. 0.78 (78%)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PatientHospitalRecord.RiskLevel riskCategory;

    @Column(columnDefinition = "TEXT")
    private String contributingFactors; // JSON string of top features (SHAP/Importance)

    @Column(columnDefinition = "TEXT")
    private String recommendedActions; // Decision-support guidelines

    @Column(nullable = false)
    private LocalDateTime predictionTimestamp;

    @Column(columnDefinition = "TEXT")
    private String inputSnapshot; // JSON snapshot of features used for inference
}