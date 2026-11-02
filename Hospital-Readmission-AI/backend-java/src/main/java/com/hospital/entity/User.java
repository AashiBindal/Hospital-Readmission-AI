package com.hospital.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "display_id", unique = true, nullable = false)
    private String displayId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    // Never let the password hash end up in logs via Lombok's toString().
    @ToString.Exclude
    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 10)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @Column(name = "license_id", nullable = false, unique = true)
    private String licenseId;

    @Column(name = "avatar_initials")
    private String avatarInitials;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    // ==========================================
    // Fields for Forgot Password / OTP Feature
    // ==========================================
    @Column(name = "reset_token")
    private String resetToken;

    @Column(name = "reset_token_expiry")
    private LocalDateTime resetTokenExpiry;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        refreshInitials();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
        refreshInitials();
    }

    private void refreshInitials() {
        if (this.name != null && !this.name.isBlank()) {
            this.avatarInitials = generateInitials(this.name);
        }
    }

    private String generateInitials(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length >= 2) {
            return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
        } else if (parts.length == 1 && !parts[0].isEmpty()) {
            return parts[0].substring(0, Math.min(parts[0].length(), 2)).toUpperCase();
        }
        return "US";
    }

    public enum Role {
        ADMIN, DOCTOR, NURSE
    }
}