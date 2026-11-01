package com.hospital.dto.Response;

import com.hospital.entity.PatientHospitalRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictionResponseDto {
    private UUID predictionId;
    private String patientId;
    private String patientName;
    private BigDecimal riskProbabilityPercentage;
    private PatientHospitalRecord.RiskLevel riskCategory;
    private String modelVersion;
    private List<ContributingFactorDto> contributingFactors;
    private List<String> recommendedActions;
    private LocalDateTime predictionTimestamp;

    // Yahan public aur Lombok annotations hona zaroori hai
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContributingFactorDto {
        private String featureName;
        private String impactDescription;
        private double importanceScore;
    }
}