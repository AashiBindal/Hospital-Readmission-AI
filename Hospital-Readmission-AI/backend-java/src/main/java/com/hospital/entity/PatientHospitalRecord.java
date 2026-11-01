package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "patient_hospital_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PatientHospitalRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id")
    private Long batchId;

    @Column(nullable = false, unique = true)
    private String patientId;

    @Column(nullable = false)
    private String patientName;

    @Column(nullable = false)
    private int age;

    @Column(nullable = false)
    private String gender;

    @Column(nullable = false)
    private LocalDate admissionDate;

    @Column(nullable = false)
    private LocalDate dischargeDate;

    @Column(nullable = false)
    private String primaryDiagnosis;

    private int previousAdmissions;

    @Column(length = 1000)
    private String medicines;

    @Column(length = 1000)
    private String chronicDiseases;

    private String dischargeType;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RiskLevel riskLevel = RiskLevel.NOT_PREDICTED;

    private Double riskScore;

    @Builder.Default
    private boolean readyForPrediction = true;

    public enum RiskLevel {
        LOW, MEDIUM, HIGH, NOT_PREDICTED
    }

    public long getLengthOfStay() {
        if (admissionDate != null && dischargeDate != null) {
            return ChronoUnit.DAYS.between(admissionDate, dischargeDate);
        }
        return 0;
    }
}