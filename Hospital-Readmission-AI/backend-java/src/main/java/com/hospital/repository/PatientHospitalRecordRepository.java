package com.hospital.repository;

import com.hospital.entity.PatientHospitalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface PatientHospitalRecordRepository extends JpaRepository<PatientHospitalRecord, Long>, JpaSpecificationExecutor<PatientHospitalRecord> {
    Optional<PatientHospitalRecord> findByPatientId(String patientId);
    boolean existsByPatientId(String patientId);

    Optional<Object> findFirstByPatientIdOrderByAdmissionDateDesc(String patientId);
}