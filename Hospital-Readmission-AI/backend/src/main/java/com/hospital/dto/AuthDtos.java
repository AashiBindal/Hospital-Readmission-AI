package com.hospital.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "Email is required.") @Email(message = "Enter a valid email address.") String email,
            @NotBlank(message = "Password is required.") String password) {
    }

    public record RegisterRequest(
            @NotBlank(message = "Full name is required.") @Size(min = 2, max = 200, message = "Name must be 2-200 characters.") String name,
            @NotBlank(message = "Email is required.") @Email(message = "Enter a valid email address.")
            @Size(max = 100, message = "Email must be at most 100 characters.") String email,
            @NotBlank(message = "Phone number is required.") @Pattern(regexp = "^[0-9]{10}$", message = "Phone number must be exactly 10 digits.") String phone,
            @NotBlank(message = "Password is required.") @Size(min = 8, max = 72, message = "Password must be 8-72 characters.") String password,
            @NotBlank(message = "Role is required.") String role,
            @NotBlank(message = "Department is required.") @Size(max = 100, message = "Department must be at most 100 characters.") String department,
            @NotBlank(message = "Employee / License ID is required.") @Size(min = 3, max = 50, message = "Employee / License ID must be 3-50 characters.") String licenseId) {
    }

    public record LoginResponse(String token, String tokenType, Instant expiresAt, UserDto user) {
    }

    public record RegisterResponse(String message, UserDto user) {
    }
}
