package com.hospital.service.ServiceImpl;

import com.hospital.Security.JwtUtils;
import com.hospital.dto.Request.LoginRequestDto;
import com.hospital.dto.Request.RegisterRequestDto;
import com.hospital.dto.Response.UserResponseDto;
import com.hospital.entity.Department;
import com.hospital.entity.User;
import com.hospital.repository.DepartmentRepository;
import com.hospital.repository.UserRepository;
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

@Service
@RequiredArgsConstructor
public class AuthServiceImpl {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;

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