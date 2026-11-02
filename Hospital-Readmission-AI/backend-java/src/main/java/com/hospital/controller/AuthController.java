package com.hospital.controller;

import com.hospital.dto.Request.LoginRequestDto;
import com.hospital.dto.Request.RegisterRequestDto;
import com.hospital.dto.Request.ResetPasswordRequestDto;
import com.hospital.dto.Response.UserResponseDto;
import com.hospital.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(@Valid @RequestBody RegisterRequestDto request) {
        UserResponseDto response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@Valid @RequestBody LoginRequestDto request) {
        String token = authService.login(request);
        return ResponseEntity.ok(token);
    }

    // ==========================================
    // 1. FORGOT PASSWORD ENDPOINT
    // ==========================================
    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(@RequestParam String email) {
        String message = authService.forgotPassword(email);
        return ResponseEntity.ok(message);
    }

    // ==========================================
    // 2. RESEND OTP ENDPOINT
    // ==========================================
    @PostMapping("/resend-otp")
    public ResponseEntity<String> resendOtp(@RequestParam String email) {
        String message = authService.resendOtp(email);
        return ResponseEntity.ok(message);
    }

    // ==========================================
    // 3. RESET PASSWORD ENDPOINT (Complete Flow)
    // ==========================================
    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@RequestBody ResetPasswordRequestDto request) {
        String message = authService.resetPassword(request);
        return ResponseEntity.ok(message);
    }
}