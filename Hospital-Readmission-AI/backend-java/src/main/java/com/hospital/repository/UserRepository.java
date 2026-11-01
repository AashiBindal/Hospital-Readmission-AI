package com.hospital.repository;

import com.hospital.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    // Find user by email
    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    // Check existence by email or license ID
    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByLicenseId(String licenseId);

    // Concurrency-safe display ID generation query
    @Query("SELECT u.displayId FROM User u ORDER BY u.displayId DESC")
    List<String> findTopDisplayIds(Pageable pageable);
}