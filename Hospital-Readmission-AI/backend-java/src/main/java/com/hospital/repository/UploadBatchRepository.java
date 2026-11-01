package com.hospital.repository;

import com.hospital.entity.UploadBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UploadBatchRepository extends JpaRepository<UploadBatch, Long> {
}