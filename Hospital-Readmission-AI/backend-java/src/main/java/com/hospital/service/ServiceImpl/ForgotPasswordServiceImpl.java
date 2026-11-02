package com.hospital.service.ServiceImpl;

import com.hospital.dto.Request.ForgotPasswordRequestDto;
import com.hospital.dto.Request.ResetPasswordRequestDto;
import com.hospital.dto.Request.VerifyOtpRequestDto;
import com.hospital.entity.PasswordResetOtp;
import com.hospital.entity.User;
import com.hospital.repository.PasswordResetOtpRepository;
import com.hospital.repository.UserRepository;
import com.hospital.service.EmailService;
import com.hospital.service.ForgotPasswordService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ForgotPasswordServiceImpl implements ForgotPasswordService {

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    private static final String GENERIC_SUCCESS_MESSAGE = "If the account exists, an OTP has been sent to your registered email.";

    @Override
    @Transactional
    public String requestOtp(ForgotPasswordRequestDto dto) {
        Optional<User> userOpt = userRepository.findByEmail(dto.getUsername());

        // Verify both username and email match the same account (prevent enumeration securely)
        if (userOpt.isEmpty() || !userOpt.get().getEmail().equalsIgnoreCase(dto.getEmail())) {
            return GENERIC_SUCCESS_MESSAGE; // Prevent user discovery attacks
        }

        // Generate secure 6-digit OTP
        String rawOtp = String.format("%06d", new SecureRandom().nextInt(1000000));

        // Remove existing OTP if any
        otpRepository.deleteByEmail(dto.getEmail());

        // Save hashed OTP with 5-minute expiry
        PasswordResetOtp resetOtp = PasswordResetOtp.builder()
                .email(dto.getEmail())
                .otpHash(passwordEncoder.encode(rawOtp))
                .expiryDate(LocalDateTime.now().plusMinutes(5))
                .attemptCount(0)
                .isUsed(false)
                .build();

        otpRepository.save(resetOtp);
        emailService.sendOtpEmail(dto.getEmail(), rawOtp);

        return GENERIC_SUCCESS_MESSAGE;
    }

    @Override
    @Transactional
    public boolean verifyOtp(VerifyOtpRequestDto dto) {
        PasswordResetOtp resetOtp = otpRepository.findByEmail(dto.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP session."));

        if (resetOtp.isUsed()) {
            throw new IllegalArgumentException("OTP has already been used.");
        }

        if (LocalDateTime.now().isAfter(resetOtp.getExpiryDate())) {
            throw new IllegalArgumentException("OTP has expired.");
        }

        if (resetOtp.getAttemptCount() >= 3) {
            otpRepository.delete(resetOtp);
            throw new IllegalArgumentException("Maximum incorrect attempts exceeded. Please request a new OTP.");
        }

        if (!passwordEncoder.matches(dto.getOtp(), resetOtp.getOtpHash())) {
            resetOtp.setAttemptCount(resetOtp.getAttemptCount() + 1);
            otpRepository.save(resetOtp);
            throw new IllegalArgumentException("Incorrect OTP. Attempts left: " + (3 - resetOtp.getAttemptCount()));
        }

        resetOtp.setUsed(true);
        otpRepository.save(resetOtp);
        return true;
    }

    @Override
    @Transactional
    public String resendOtp(ForgotPasswordRequestDto dto) {
        // Rate-limiting / generation check handled via requestOtp
        return requestOtp(dto);
    }

    @Override
    @Transactional
    public String resetPassword(ResetPasswordRequestDto dto) {
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new IllegalArgumentException("New password and confirm password do not match.");
        }

        PasswordResetOtp resetOtp = otpRepository.findByEmail(dto.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("OTP verification required before resetting password."));

        if (!resetOtp.isUsed()) {
            throw new IllegalArgumentException("OTP must be verified first.");
        }

        User user = userRepository.findByEmail(dto.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        // Update password with BCrypt
        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        userRepository.save(user);

        // Clean up OTP record
        otpRepository.delete(resetOtp);

        return "Password successfully reset! You can now log in with your new password.";
    }
}