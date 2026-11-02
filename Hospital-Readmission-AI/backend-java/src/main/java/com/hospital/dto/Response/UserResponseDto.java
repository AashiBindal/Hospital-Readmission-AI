package com.hospital.dto.Response;

import com.hospital.entity.User;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class UserResponseDto {
    private UUID id;
    private String displayId;
    private String name;
    private String email;
    private String phone;
    private User.Role role;
    private String departmentName;
    private String licenseId;
    private String avatarInitials;
    private LocalDateTime lastLogin;
    private boolean active;
}