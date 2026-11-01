package com.hospital.repository;

import com.hospital.entity.Patient;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID>, JpaSpecificationExecutor<Patient> {
    Optional<Patient> findByDisplayId(String displayId);
    boolean existsByDisplayId(String displayId);

    @Query("SELECT p.displayId FROM Patient p ORDER BY p.displayId DESC")
    List<String> findTopDisplayIds(Pageable pageable);
}