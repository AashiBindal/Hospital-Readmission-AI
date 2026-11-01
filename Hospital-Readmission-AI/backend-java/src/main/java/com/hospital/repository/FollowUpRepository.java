package com.hospital.repository;

import com.hospital.entity.FollowUp;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FollowUpRepository extends JpaRepository<FollowUp, UUID>, JpaSpecificationExecutor<FollowUp> {
    Optional<FollowUp> findByDisplayId(String displayId);
    boolean existsByDisplayId(String displayId);
    long countByStatus(FollowUp.Status status);

    @Query("SELECT f.displayId FROM FollowUp f ORDER BY f.displayId DESC")
    List<String> findTopDisplayIds(Pageable pageable);
}