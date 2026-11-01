package com.hospital.repository;

import com.hospital.entity.PredictionFactor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface PredictionFactorRepository extends JpaRepository<PredictionFactor, UUID> {

    @Query("SELECT f.factorName, COUNT(f), AVG(f.contribution) FROM PredictionFactor f GROUP BY f.factorName ORDER BY COUNT(f) DESC")
    List<Object[]> getRiskFactorAggregations();
}