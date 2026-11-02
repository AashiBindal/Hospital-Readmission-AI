package com.hospital.repository;

import com.hospital.entity.PredictionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PredictionHistoryRepository extends JpaRepository<PredictionHistory, Long> {
    List<PredictionHistory> findByPatientIdOrderByPredictionTimestampDesc(String patientId);
}