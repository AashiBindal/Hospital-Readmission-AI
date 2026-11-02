package com.hospital.dto.Request;

import com.hospital.entity.User;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.UUID;

@Data
public class RegisterRequestDto {
    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters long")
    private String password;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^\\d{10}$", message = "Phone number must be exactly 10 digits")
    private String phone;

    @NotNull(message = "Role is required")
    private User.Role role;

    @NotNull(message = "Department ID is required")
    private UUID departmentId;

    @NotBlank(message = "License ID is required")
    private String licenseId;
}