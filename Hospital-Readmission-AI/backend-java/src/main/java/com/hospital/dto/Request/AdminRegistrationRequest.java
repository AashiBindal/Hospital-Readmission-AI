package com.hospital.dto.Request;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "admin_registration_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminRegistrationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fullName;
    private String email;
    private String username;
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private RequestStatus status; // PENDING, APPROVED, REJECTED

    private LocalDateTime requestedAt;

    @PrePersist
    public void prePersist() {
        this.requestedAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = RequestStatus.PENDING;
        }
    }

    public enum RequestStatus {
        PENDING, APPROVED, REJECTED
    }
}