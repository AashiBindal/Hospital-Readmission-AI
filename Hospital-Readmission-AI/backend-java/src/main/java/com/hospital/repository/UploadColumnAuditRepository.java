package com.hospital.repository;

import com.hospital.entity.UploadColumnAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface UploadColumnAuditRepository extends JpaRepository<UploadColumnAudit, UUID> {
}