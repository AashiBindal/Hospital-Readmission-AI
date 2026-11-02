package com.hospital.repository;

import com.hospital.entity.DataUpload;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DataUploadRepository extends JpaRepository<DataUpload, UUID> {
    Optional<DataUpload> findByDisplayId(String displayId);
    boolean existsByDisplayId(String displayId);

    @Query("SELECT d.displayId FROM DataUpload d ORDER BY d.displayId DESC")
    List<String> findTopDisplayIds(Pageable pageable);
}