package com.hospital.dto.Request;

import com.hospital.entity.Patient;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class PatientRequestDto {
    @NotBlank(message = "Patient name is required")
    private String name;

    @Min(value = 25, message = "Age must be at least 25")
    @Max(value = 85, message = "Age must not exceed 85")
    private int age;

    @NotNull(message = "Gender is required")
    private Patient.Gender gender;

    @NotNull(message = "Department ID is required")
    private UUID departmentId;

    @NotBlank(message = "Primary diagnosis is required")
    private String primaryDiagnosis;

    private LocalDate admissionDate;
    private LocalDate dischargeDate;

    @Min(value = 2, message = "Length of stay must be at least 2 days")
    @Max(value = 13, message = "Length of stay must not exceed 13 days")
    private int lengthOfStay;

    @Min(value = 0, message = "Prior admissions cannot be negative")
    @Max(value = 5, message = "Prior admissions cannot exceed 5")
    private int priorAdmissions;

    @Min(value = 3, message = "Medication count must be at least 3")
    @Max(value = 15, message = "Medication count must not exceed 15")
    private int medicationsCount;

    @Min(value = 0, message = "Comorbidities count cannot be negative")
    @Max(value = 6, message = "Comorbidities count cannot exceed 6")
    private int comorbiditiesCount;

    @DecimalMin(value = "5.2", message = "HbA1c must be at least 5.2")
    @DecimalMax(value = "9.6", message = "HbA1c must not exceed 9.6")
    private BigDecimal hba1c;

    @Min(value = 118, message = "Systolic BP must be at least 118")
    @Max(value = 166, message = "Systolic BP must not exceed 166")
    private Integer systolicBp;

    @DecimalMin(value = "24.0", message = "eGFR must be at least 24.0")
    @DecimalMax(value = "102.0", message = "eGFR must not exceed 102.0")
    private BigDecimal egfr;

    @NotNull(message = "Attending physician ID is required")
    private UUID attendingPhysicianId;

    @NotNull(message = "Follow-up status is required")
    private Patient.FollowUpStatus followUpStatus;

    private LocalDate nextFollowUp;
    private Boolean observedReadmitted;
    private String notes;
}