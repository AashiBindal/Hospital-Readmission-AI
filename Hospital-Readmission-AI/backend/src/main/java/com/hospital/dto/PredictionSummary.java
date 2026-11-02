package com.hospital.dto;

import java.time.LocalDateTime;

/** Latest stored prediction (riskScore as whole percent 0-100, riskLevel "Low"/"Medium"/"High"). */
public record PredictionSummary(long predictionId, long admissionId, Integer riskScore, String riskLevel,
                                String modelVersion, LocalDateTime predictedAt) {
}
