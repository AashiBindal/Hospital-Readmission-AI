package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "password_reset_otps")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetOtp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String otpHash; // Stored securely (BCrypt or SHA-256 hashed)

    @Column(nullable = false)
    private LocalDateTime expiryDate;

    @Column(nullable = false)
    private int attemptCount = 0; // Tracks incorrect attempts

    @Column(nullable = false)
    private boolean isUsed = false;
}