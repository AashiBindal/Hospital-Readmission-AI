package com.hospital.dto.Request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * Input for a risk prediction. Ranges are the application-specific limits from the
 * MediSight spec (not universal medical ranges).
 *
 * Wrapper types (Integer) + @NotNull on purpose: a missing value must be rejected,
 * never silently defaulted to 0 the way a primitive int would be.
 */
@Data
public class PredictionRequestDto {

    private UUID patientId; // optional: null = standalone prediction

    @NotNull(message = "Age is required")
    @Min(value = 25, message = "Age must be between 25 and 85")
    @Max(value = 85, message = "Age must be between 25 and 85")
    private Integer age;

    @NotBlank(message = "Gender is required")
    @Pattern(regexp = "(?i)MALE|FEMALE|OTHER", message = "Gender must be MALE, FEMALE or OTHER")
    private String gender;

    @NotBlank(message = "Primary diagnosis is required")
    private String primaryDiagnosis;

    @NotNull(message = "Prior admissions is required")
    @Min(value = 0, message = "Prior admissions must be between 0 and 5")
    @Max(value = 5, message = "Prior admissions must be between 0 and 5")
    private Integer priorAdmissions;

    @NotNull(message = "Length of stay is required")
    @Min(value = 2, message = "Length of stay must be between 2 and 13 days")
    @Max(value = 13, message = "Length of stay must be between 2 and 13 days")
    private Integer lengthOfStay;

    @NotNull(message = "Medications count is required")
    @Min(value = 3, message = "Medications count must be between 3 and 15")
    @Max(value = 15, message = "Medications count must be between 3 and 15")
    private Integer medicationsCount;

    @NotNull(message = "Comorbidities count is required")
    @Min(value = 0, message = "Comorbidities count must be between 0 and 6")
    @Max(value = 6, message = "Comorbidities count must be between 0 and 6")
    private Integer comorbiditiesCount;

    @NotBlank(message = "Discharge type is required")
    @Pattern(regexp = "(?i)HOME_SELF_CARE|HOME_HEALTH|SNF|IRF|AMA|HOSPICE",
            message = "Discharge type must be one of HOME_SELF_CARE, HOME_HEALTH, SNF, IRF, AMA, HOSPICE")
    private String dischargeType;

    private List<String> chronicDiseases;

    // NOTE: the old no-op setPreviousAdmissions(int) stub was removed. It compiled but
    // silently discarded the value. The field is priorAdmissions.
}