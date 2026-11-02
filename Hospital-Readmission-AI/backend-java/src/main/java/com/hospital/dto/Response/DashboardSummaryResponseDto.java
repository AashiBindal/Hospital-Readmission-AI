package com.hospital.dto.Response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DashboardSummaryResponseDto {
    private long totalPatients;
    private long highRiskPatients;
    private BigDecimal actualReadmissionRate; // Nullable if no known outcomes ("N/A")
    private long pendingFollowUps;
    private RiskDistributionDto riskDistribution;
    private List<HighRiskPatientSummaryDto> topHighRiskPatients;
    private List<AgeGroupDistributionDto> ageGroupDistribution;

    @Data
    @Builder
    public static class RiskDistributionDto {
        private long low;
        private long medium;
        private long high;
    }

    @Data
    @Builder
    public static class HighRiskPatientSummaryDto {
        private UUID patientId;
        private String displayId;
        private String patientName;
        private int age;
        private String primaryDiagnosis;
        private BigDecimal riskScore;
        private String riskLevel;
    }

    @Data
    @Builder
    public static class AgeGroupDistributionDto {
        private String ageGroup; // e.g. "25-34", "35-44", etc.
        private long count;
    }
}