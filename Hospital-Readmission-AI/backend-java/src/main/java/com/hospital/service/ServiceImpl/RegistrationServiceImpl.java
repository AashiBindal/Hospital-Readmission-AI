//package com.hospital.service.ServiceImpl;
//
//import com.hospital.dto.Request.AdminRegistrationRequest;
//import com.hospital.dto.Request.UserRegistrationDto;
//import com.hospital.entity.User;
//import com.hospital.Enum.Role;
//import com.hospital.repository.AdminRegistrationRequestRepository;
//import com.hospital.repository.UserRepository;
//import com.hospital.service.RegistrationService;
//import lombok.RequiredArgsConstructor;
//import org.springframework.security.crypto.password.PasswordEncoder;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//
//import java.util.HashSet;
//import java.util.Set;
//
//@Service
//@RequiredArgsConstructor
//public class RegistrationServiceImpl implements RegistrationService {
//
//    private final UserRepository userRepository;
//    private final AdminRegistrationRequestRepository adminRequestRepository;
//    private final PasswordEncoder passwordEncoder;
//
//    @Override
//    @Transactional
//    public String registerUser(UserRegistrationDto dto) {
//        if (dto.getRole() == null) {
//            throw new IllegalArgumentException("Role is required.");
//        }
//
//        validateUniqueness(dto.getUsername(), dto.getEmail());
//
//        // ADMIN requires approval
//        if (dto.getRole() == Role.ADMIN) {
//            AdminRegistrationRequest request = AdminRegistrationRequest.builder()
//                    .fullName(dto.getFullName())
//                    .email(dto.getEmail())
//                    .username(dto.getUsername())
//                    .passwordHash(passwordEncoder.encode(dto.getPassword()))
//                    .status(AdminRegistrationRequest.RequestStatus.PENDING)
//                    .build();
//
//            adminRequestRepository.save(request);
//            return "Admin registration request submitted successfully. Pending approval from an administrator.";
//        }
//
//        // DOCTOR / NURSE register directly
//        User user = new User();
//        user.setFullName(dto.getFullName());
//        user.setEmail(dto.getEmail());
//        user.setUsername(dto.getUsername());
//        user.setPassword(passwordEncoder.encode(dto.getPassword()));
//        user.setRoles(new HashSet<>(Set.of(dto.getRole())));   // mutable set for Hibernate
//
//        userRepository.save(user);
//        return "Registration successful! You can now log in.";
//    }
//
//    private void validateUniqueness(String username, String email) {
//        if (userRepository.existsByUsername(username) || adminRequestRepository.existsByUsername(username)) {
//            throw new IllegalArgumentException("Username is already taken.");
//        }
//        if (userRepository.existsByEmail(email) || adminRequestRepository.existsByEmail(email)) {
//            throw new IllegalArgumentException("Email is already registered.");
//        }
//    }
//}