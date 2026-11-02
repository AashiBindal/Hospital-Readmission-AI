package com.hospital.dto;

import java.time.LocalDateTime;

/** Public view of a dbo.Users row. Never contains the password hash. */
public record UserDto(int id, String name, String email, String role, String department, String phone,
                      String licenseId, boolean active, String avatarInitials, LocalDateTime lastLogin,
                      LocalDateTime createdAt) {
}
