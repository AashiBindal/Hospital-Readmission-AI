package com.hospital.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class PatientRequests {

    private PatientRequests() {
    }

    /** ICD-9-CM as stored by the ETL: 3 digits (+ optional decimals), or V/E codes. */
    public static final String ICD9 = "^([0-9]{3}(\\.[0-9]{1,2})?|V[0-9]{2}(\\.[0-9]{1,2})?|E[0-9]{3}(\\.[0-9])?)$";
    public static final String AGE_GROUP = "^\\[(0-10|10-20|20-30|30-40|40-50|50-60|60-70|70-80|80-90|90-100)\\)$";

    /**
     * POST /patients - registers a patient together with the admission being recorded.
     * Only values the clinician enters are stored; nothing is defaulted or imputed.
     */
    public record CreatePatientRequest(
            @NotBlank(message = "Patient MRN / external ID is required.")
            @Size(max = 50, message = "Patient ID must be at most 50 characters.")
            @Pattern(regexp = "^[A-Za-z0-9-]+$", message = "Patient ID may contain letters, digits and '-' only.")
            String externalPatientId,
            @NotBlank(message = "Gender is required.")
            @Pattern(regexp = "^(Female|Male|Unknown/Invalid)$", message = "Gender must be Female, Male or Unknown/Invalid.")
            String gender,
            @Pattern(regexp = "^(Caucasian|AfricanAmerican|Hispanic|Asian|Other)$", message = "Race must be one of the dataset categories.")
            String race,
            @NotBlank(message = "Age band is required.")
            @Pattern(regexp = AGE_GROUP, message = "Age band must look like [60-70).")
            String ageGroup,
            @Size(max = 100, message = "Department must be at most 100 characters.") String department,
            @NotBlank(message = "Primary diagnosis (ICD-9) is required.")
            @Pattern(regexp = ICD9, message = "Primary diagnosis must be an ICD-9-CM code such as 428, 250.83 or V57.")
            String primaryDiagnosisCode,
            @Pattern(regexp = ICD9, message = "Secondary diagnosis must be an ICD-9-CM code.") String secondaryDiagnosisCode,
            @NotNull(message = "Length of stay is required.") @Min(value = 0, message = "Length of stay cannot be negative.")
            @Max(value = 365, message = "Length of stay must be at most 365 days.") Integer lengthOfStay,
            @NotNull(message = "Prior inpatient admissions is required.") @Min(value = 0, message = "Prior admissions cannot be negative.")
            @Max(value = 100, message = "Prior admissions must be at most 100.") Integer priorAdmissions,
            @Min(value = 0, message = "Emergency visits cannot be negative.") @Max(100) Integer emergencyVisits,
            @Min(value = 0, message = "Outpatient visits cannot be negative.") @Max(100) Integer outpatientVisits,
            @NotNull(message = "Medications count is required.") @Min(value = 0, message = "Medications count cannot be negative.")
            @Max(value = 200, message = "Medications count must be at most 200.") Integer medicationsCount,
            @NotNull(message = "Number of diagnoses is required.") @Min(value = 1, message = "At least one diagnosis is required.")
            @Max(value = 50, message = "Number of diagnoses must be at most 50.") Integer numDiagnoses,
            @Min(value = 0, message = "Lab tests cannot be negative.") @Max(500) Integer numLabTests,
            @Min(value = 0, message = "Procedures cannot be negative.") @Max(50) Integer numProcedures,
            @Pattern(regexp = "^(NotTested|Norm|>7|>8)$", message = "A1C result must be NotTested, Norm, >7 or >8.") String a1cResult,
            @Pattern(regexp = "^(NotTested|Norm|>200|>300)$", message = "Max glucose serum must be NotTested, Norm, >200 or >300.") String maxGluSerum) {
    }

    /** PUT /patients/{id} - demographic corrections. */
    public record UpdatePatientRequest(
            @NotBlank(message = "Gender is required.")
            @Pattern(regexp = "^(Female|Male|Unknown/Invalid)$", message = "Gender must be Female, Male or Unknown/Invalid.")
            String gender,
            @Pattern(regexp = "^(Caucasian|AfricanAmerican|Hispanic|Asian|Other)$", message = "Race must be one of the dataset categories.")
            String race) {
    }
}
