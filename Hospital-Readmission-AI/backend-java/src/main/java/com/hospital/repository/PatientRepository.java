package com.hospital.repository;

import com.hospital.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Placeholder repository. TODO (Member 2): add query methods as needed. */
@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {
}
