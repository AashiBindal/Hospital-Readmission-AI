package com.hospital.dto.Request;

import lombok.Builder;
import lombok.Data;
import java.util.Map;

@Data
@Builder
public class AnalyticsOverviewDto {
    private long totalPatients;
    private long totalPredictions;
    private long highRiskPatientsCount;

    // Actual readmission metrics (handled safely if outcome tracking is pending)
    private boolean actualReadmissionDataAvailable;
    private Long actualReadmissionCount;
    private Double actualReadmissionRatePercentage;

    private Map<String, Long> riskDistribution;
    private FollowUpPerformanceSummary followUpPerformance;

    @Data
    @Builder
    public static class FollowUpPerformanceSummary {
        private long totalFollowUps;
        private long pendingCount;
        private long completedCount;
        private long overdueCount;
        private double completionRatePercentage;
    }
}