package com.hospital.entity;

import com.hospital.entity.RiskPrediction;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "prediction_factors")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionFactor {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    private RiskPrediction riskPrediction;

    @Column(name = "factor_name", nullable = false)
    private String factorName;

    @Column(name = "factor_value", nullable = false)
    private String factorValue;

    @Column(precision = 8, scale = 4)
    private BigDecimal contribution;

    @Column(columnDefinition = "TEXT")
    private String explanation;
}