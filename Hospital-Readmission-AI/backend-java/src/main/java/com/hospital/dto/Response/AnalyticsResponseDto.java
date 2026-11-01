package com.hospital.dto.Response;

import com.hospital.entity.FollowUp;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class AnalyticsResponseDto {
    private ReadmissionAnalyticsDto readmission;
    private PredictionAnalyticsDto prediction;
    private List<DepartmentAnalyticsDto> departmentAnalytics;
    private List<DiagnosisAnalyticsDto> diagnosisAnalytics;
    private List<RiskFactorAnalyticsDto> riskFactors;
    private FollowUpAnalyticsDto followUpAnalytics;
    private List<TrendChartDto> monthlyTrends;

    @Data
    @Builder
    public static class ReadmissionAnalyticsDto {
        private long totalDischargedPatients;
        private long knownOutcomePatients;
        private long actualReadmittedPatients;
        private BigDecimal actualReadmissionRate; // Percentage (0-100)
    }

    @Data
    @Builder
    public static class PredictionAnalyticsDto {
        private long totalPredictions;
        private long lowRiskPredictions;
        private long mediumRiskPredictions;
        private long highRiskPredictions;
        private BigDecimal averagePredictedProbability;
    }

    @Data
    @Builder
    public static class DepartmentAnalyticsDto {
        private String departmentId;
        private String departmentName;
        private long totalPatients;
        private long highRiskPatients;
        private long actualReadmissions;
        private BigDecimal readmissionRate;
    }

    @Data
    @Builder
    public static class DiagnosisAnalyticsDto {
        private String diagnosis;
        private long patientCount;
        private long highRiskCount;
        private long actualReadmissions;
        private BigDecimal readmissionRate;
    }

    @Data
    @Builder
    public static class RiskFactorAnalyticsDto {
        private String factorName;
        private long frequency;
        private BigDecimal averageContribution;
    }

    @Data
    @Builder
    public static class FollowUpAnalyticsDto {
        private long totalFollowUps;
        private long pendingFollowUps;
        private long completedFollowUps;
        private long overdueFollowUps;
        private BigDecimal completionRate;
        private List<PriorityCountDto> byPriority;
        private List<UserCountDto> byAssignedUser;
    }

    @Data
    @Builder
    public static class PriorityCountDto {
        private FollowUp.Priority priority;
        private long count;
    }

    @Data
    @Builder
    public static class UserCountDto {
        private String userId;
        private String userName;
        private long count;
    }

    @Data
    @Builder
    public static class TrendChartDto {
        private String month; // e.g., "2026-10"
        private String fullLabel; // e.g., "October 2026"
        private BigDecimal observedRate;
        private BigDecimal predictedRate;
        private long totalDischarges;
        private long highRisk;
    }
}