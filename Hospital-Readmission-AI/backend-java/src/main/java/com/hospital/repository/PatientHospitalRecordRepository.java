package com.hospital.repository;

import com.hospital.entity.PatientHospitalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PatientHospitalRecordRepository extends JpaRepository<PatientHospitalRecord, Long> {
    List<PatientHospitalRecord> findByBatchId(Long batchId);
}