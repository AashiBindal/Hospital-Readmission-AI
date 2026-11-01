package com.hospital.repository;

import com.hospital.dto.Request.AdminRegistrationRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AdminRegistrationRequestRepository extends JpaRepository<AdminRegistrationRequest, Long> {
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<AdminRegistrationRequest> findByStatus(AdminRegistrationRequest.RequestStatus status);
}