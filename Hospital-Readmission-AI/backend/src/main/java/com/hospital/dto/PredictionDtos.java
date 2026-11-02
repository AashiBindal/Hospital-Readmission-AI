package com.hospital.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class PredictionDtos {

    private PredictionDtos() {
    }

    public record PredictionRequest(@NotNull(message = "admissionId is required.")
                                    @Positive(message = "admissionId must be positive.") Long admissionId) {
    }

    public record Factor(String label, Double contribution) {
    }

    /**
     * riskScore: whole percent (0-100); probability: model output 0-1 exactly as stored.
     * factors: attributions returned by the model (empty when the model returns none).
     */
    public record PredictionResult(long predictionId, long patientId, String externalPatientId, long admissionId,
                                   Integer riskScore, BigDecimal probability, String riskLevel, String modelVersion,
                                   LocalDateTime predictedAt, List<Factor> factors, String recommendedAction) {
    }
}
