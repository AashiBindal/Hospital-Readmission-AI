package com.hospital.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Example entity mapped to dbo.Patients (see database/schema.sql).
 * TODO (Member 2): add remaining columns and the other entities after schema is finalised.
 */
@Entity
@Table(name = "Patients")
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "PatientId")
    private Long patientId;

    @Column(name = "ExternalPatientId", length = 50)
    private String externalPatientId;

    @Column(name = "Gender", length = 20)
    private String gender;

    public Long getPatientId() { return patientId; }
    public void setPatientId(Long patientId) { this.patientId = patientId; }
    public String getExternalPatientId() { return externalPatientId; }
    public void setExternalPatientId(String externalPatientId) { this.externalPatientId = externalPatientId; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
}
