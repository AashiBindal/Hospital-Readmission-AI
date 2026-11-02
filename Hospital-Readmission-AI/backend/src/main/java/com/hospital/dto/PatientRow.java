package com.hospital.dto;

import java.time.LocalDateTime;

/**
 * One patient in the registry list. Clinical fields come from the patient's most
 * recent admission (highest AdmissionId - the dataset has no admission dates).
 * Risk fields come from the latest stored ML prediction and are null when the
 * patient has not been scored yet.
 */
public record PatientRow(
        String id,
        long patientId,
        String externalPatientId,
        String name,
        String gender,
        String race,
        boolean hasDemographicConflict,
        int admissionsCount,
        Long latestAdmissionId,
        String ageGroup,
        String department,
        String primaryDiagnosisCode,
        String diagnosisCategory,
        String primaryDiagnosis,
        Integer lengthOfStay,
        Integer priorAdmissions,
        Integer emergencyVisits,
        Integer medicationsCount,
        Integer numDiagnoses,
        String a1cResult,
        String readmissionStatus,
        Integer riskScore,
        String riskLevel,
        LocalDateTime predictedAt) {
}
