package com.hospital.controller;

import com.hospital.dto.Request.ForgotPasswordRequestDto;
import com.hospital.dto.Request.ResetPasswordRequestDto;
import com.hospital.dto.Request.VerifyOtpRequestDto;
import com.hospital.service.ForgotPasswordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/forgot-password")
@RequiredArgsConstructor
public class ForgotPasswordController {

    private final ForgotPasswordService forgotPasswordService;

    @PostMapping("/request")
    public ResponseEntity<String> requestOtp(@Valid @RequestBody ForgotPasswordRequestDto requestDto) {
        String response = forgotPasswordService.requestOtp(requestDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<String> verifyOtp(@Valid @RequestBody VerifyOtpRequestDto requestDto) {
        boolean isValid = forgotPasswordService.verifyOtp(requestDto);
        if (isValid) {
            return ResponseEntity.ok("OTP verified successfully. You can now reset your password.");
        }
        return ResponseEntity.badRequest().body("Invalid OTP verification.");
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<String> resendOtp(@Valid @RequestBody ForgotPasswordRequestDto requestDto) {
        String response = forgotPasswordService.resendOtp(requestDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset")
    public ResponseEntity<String> resetPassword(@Valid @RequestBody ResetPasswordRequestDto requestDto) {
        String response = forgotPasswordService.resetPassword(requestDto);
        return ResponseEntity.ok(response);
    }
}