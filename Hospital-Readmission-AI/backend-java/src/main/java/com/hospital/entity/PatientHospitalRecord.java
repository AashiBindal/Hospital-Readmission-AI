package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

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

    @Column(nullable = false)
    private Long batchId;

    @Column(nullable = false)
    private String patientId;

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

    @Column(nullable = false)
    private boolean readyForPrediction = true;
}