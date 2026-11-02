package com.hospital.dto;

import java.util.List;

public record DashboardSummary(long totalPatients, long totalAdmissions, long scoredPatients, long unscoredPatients,
                               long lowRiskCount, long mediumRiskCount, long highRiskCount, Double avgPredictedRisk,
                               Double overallObservedRate, long pendingFollowUpsCount, long overdueFollowUpsCount,
                               long highRiskWithoutFollowUp, List<Intervention> recommendedInterventions,
                               List<PatientRow> top5HighRiskPatients) {

    /** Data-driven work item; counts come from the database at request time. */
    public record Intervention(String id, String title, String description, String level, String targetPath) {
    }
}
