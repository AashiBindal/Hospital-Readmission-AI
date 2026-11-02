package com.hospital.service.ServiceImpl;

import com.hospital.Security.JwtUtils;
import com.hospital.dto.Request.LoginRequestDto;
import com.hospital.dto.Request.RegisterRequestDto;
import com.hospital.dto.Request.ResetPasswordRequestDto;
import com.hospital.dto.Response.UserResponseDto;
import com.hospital.entity.Department;
import com.hospital.entity.User;
import com.hospital.repository.DepartmentRepository;
import com.hospital.repository.UserRepository;
import com.hospital.service.AuthService;
import com.hospital.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService; // Uncomment kar lena agar Email Service bni hui hai

    @Transactional
    public UserResponseDto register(RegisterRequestDto request) {
        if (request.getRole() == User.Role.ADMIN) {
            throw new IllegalArgumentException("Admin registration is not allowed via public endpoint.");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email is already registered.");
        }

        if (userRepository.existsByLicenseId(request.getLicenseId())) {
            throw new IllegalArgumentException("License ID is already registered.");
        }

        Department department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid department ID."));

        if (!department.isActive()) {
            throw new IllegalArgumentException("Selected department is inactive.");
        }

        String displayId = generateNextDisplayId();

        User user = User.builder()
                .displayId(displayId)
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .role(request.getRole())
                .department(department)
                .licenseId(request.getLicenseId())
                .active(true)
                .build();

        User savedUser = userRepository.save(user);
        return mapToDto(savedUser);
    }

    public String login(LoginRequestDto request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            user.setLastLogin(LocalDateTime.now());
            userRepository.save(user);
        });

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        UserDetails userDetails = new org.springframework.security.core.userdetails.User(
                user.getEmail(), "",
                List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
        return jwtUtils.generateToken((Authentication) userDetails);
    }

    // ==========================================
    // 1. FORGOT PASSWORD METHOD
    // ==========================================
    @Transactional
    public String forgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User with this email does not exist."));

        // Generate 6-digit random OTP
        String otp = String.format("%06d", new Random().nextInt(999999));

        // User entity me fields honi chahiye: resetToken/otp aur resetTokenExpiry
        user.setResetToken(otp);
        user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(10)); // OTP valid for 10 mins
        userRepository.save(user);

        // TODO: Yaha par email send karne ka code call hoga
        // emailService.sendEmail(user.getEmail(), "Password Reset OTP", "Your OTP is: " + otp);

        return "OTP has been sent to your registered email.";
    }

    // ==========================================
    // 2. RESEND OTP METHOD
    // ==========================================
    @Transactional
    public String resendOtp(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User with this email does not exist."));

        // Generate a new 6-digit OTP
        String newOtp = String.format("%06d", new Random().nextInt(999999));

        user.setResetToken(newOtp);
        user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        // TODO: Yaha par email send karne ka code call hoga
        emailService.sendOtpEmail(user.getEmail(), newOtp);


        return "New OTP has been resent successfully to your email.";
    }

    // ==========================================
    // 3. RESET PASSWORD METHOD
    // ==========================================
    @Transactional
    public String resetPassword(ResetPasswordRequestDto request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User with this email does not exist."));

        // Check if OTP matches
        if (user.getResetToken() == null || !user.getResetToken().equals(request.getOtp())) {
            throw new IllegalArgumentException("Invalid OTP.");
        }

        // Check if OTP is expired
        if (user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("OTP has expired. Please request a new one.");
        }

        // Update password and clear reset token fields
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);

        return "Password has been reset successfully.";
    }


    @Transactional
    public synchronized String generateNextDisplayId() {
        List<String> topIds = userRepository.findTopDisplayIds(PageRequest.of(0, 1));
        int nextNum = 1;
        if (!topIds.isEmpty()) {
            try {
                String maxId = topIds.get(0);
                String numPart = maxId.replace("USR-", "");
                nextNum = Integer.parseInt(numPart) + 1;
            } catch (Exception ignored) {}
        }
        return String.format("USR-%03d", nextNum);
    }

    private UserResponseDto mapToDto(User user) {
        return UserResponseDto.builder()
                .id(user.getId())
                .displayId(user.getDisplayId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .departmentName(user.getDepartment() != null ? user.getDepartment().getName() : null)
                .licenseId(user.getLicenseId())
                .avatarInitials(user.getAvatarInitials())
                .lastLogin(user.getLastLogin())
                .active(user.isActive())
                .build();
    }
}