package com.hospital.dto.Response;

import com.hospital.entity.Patient;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class PatientResponseDto {
    private UUID id;
    private String displayId;
    private String patientName;
    private int age;
    private String gender;
    private String departmentId;
    private String departmentName;
    private String primaryDiagnosis;
    private LocalDate admissionDate;
    private LocalDate dischargeDate;
    private long lengthOfStay;
    private int previousAdmissions;
    private int medicationsCount;
    private int comorbiditiesCount;
    private BigDecimal hba1c;
    private Integer systolicBp;
    private BigDecimal egfr;
    private BigDecimal riskScore;
    private Patient.RiskLevel riskLevel;
    private UUID attendingPhysicianId;
    private String attendingPhysicianName;
    private Patient.FollowUpStatus followUpStatus;
    private LocalDate nextFollowUp;
    private Boolean observedReadmitted;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}