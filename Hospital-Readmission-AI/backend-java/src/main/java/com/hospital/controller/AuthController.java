package com.hospital.controller;

import com.hospital.Security.JwtUtils;
import com.hospital.dto.Request.LoginRequest;
import com.hospital.dto.Response.JwtResponse;
import com.hospital.entity.User;
import com.hospital.repository.UserRepository;
import com.hospital.service.CaptchaService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired
    CaptchaService captchaService;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

        // 1. Verify CAPTCHA first
        boolean isCaptchaValid = captchaService.verifyCaptcha(loginRequest.getCaptchaToken());
        if (!isCaptchaValid) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "Invalid CAPTCHA verification. Please try again."));
        }

        try {
            // 2. Authenticate credentials (supports Username or Email via UserDetailsService lookup)
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getUsernameOrEmail(),
                            loginRequest.getPassword()
                    )
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtUtils.generateJwtToken(authentication);

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            List<String> roles = userDetails.getAuthorities().stream()
                    .map(item -> item.getAuthority())
                    .collect(Collectors.toList());

            User user = userRepository.findByUsernameOrEmail(userDetails.getUsername(), userDetails.getUsername())
                    .orElseThrow(() -> new RuntimeException("Error: User not found."));

            return ResponseEntity.ok(new JwtResponse(
                    jwt,
                    "Bearer",
                    user.getId(),
                    user.getUsername(),
                    user.getEmail(),
                    roles
            ));

        } catch (Exception e) {
            return ResponseEntity.status(401).body(java.util.Map.of("error", "Invalid username/email or password."));
        }
    }
}