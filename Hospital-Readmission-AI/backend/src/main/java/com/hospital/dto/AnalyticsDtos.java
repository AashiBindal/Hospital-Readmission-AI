package com.hospital.dto;

/**
 * Analytics rows. All rates are percentages with one decimal. "Observed" values come
 * from Admissions.ReadmissionStatus (stays that ended in death are excluded because they
 * cannot be readmitted). Predicted values are averages of stored ML predictions and are
 * null when no admission in the group has been scored.
 */
public final class AnalyticsDtos {

    private AnalyticsDtos() {
    }

    public record CohortSummary(long totalPatients, long totalAdmissions, long eligibleAdmissions,
                                Double observedReadmissionRate, long scoredPatients, long unscoredPatients,
                                long lowRiskCount, long mediumRiskCount, long highRiskCount,
                                Double avgPredictedRisk) {
    }

    public record LengthOfStayPoint(String label, int lengthOfStay, String fullLabel, long totalDischarges,
                                    long readmitted, Double observedRate, Double predictedRate, long scoredCount) {
    }

    public record AgeGroupPoint(String ageGroup, String label, long patients, long readmitted,
                                Double readmissionRate, Double avgRisk, long scoredCount) {
    }

    public record DiagnosisPoint(String name, long count, long readmitted, Double readmissionRate,
                                 Double avgRiskScore, long scoredCount) {
    }

    public record RiskFactor(String key, String name, long affectedCount, long totalCohort, Double prevalencePct,
                             Double readmissionRateWith, Double readmissionRateWithout, Double relativeRisk,
                             String multiplier, Integer relativeImpact, String clinicalNote) {
    }

    public record DepartmentOption(String name, long admissions) {
    }
}
