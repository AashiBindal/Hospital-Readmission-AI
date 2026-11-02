package com.hospital.service;

import com.hospital.dto.AuthDtos.LoginRequest;
import com.hospital.dto.AuthDtos.LoginResponse;
import com.hospital.dto.AuthDtos.RegisterRequest;
import com.hospital.dto.UserDto;
import com.hospital.exception.ApiException;
import com.hospital.repository.UserRepository;
import com.hospital.repository.UserRepository.UserRecord;
import com.hospital.security.JwtService;
import com.hospital.security.Role;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private static final String BAD_CREDENTIALS = "Invalid email address or password. Please verify your credentials.";

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    /** Self-registration is limited to the clinical roles offered by the UI (Doctor, Nurse). */
    @Transactional
    public UserDto register(RegisterRequest req) {
        Role role = Role.parse(req.role());
        if (role != Role.DOCTOR && role != Role.NURSE) {
            throw ApiException.badRequest("Role must be Doctor or Nurse. Admin accounts are created by an administrator.");
        }
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailOrUsername(email)) {
            throw ApiException.conflict("Email already registered");
        }
        try {
            int id = users.insert(email, encoder.encode(req.password()), req.name().trim(), role,
                    req.department().trim(), req.phone().trim(), req.licenseId().trim());
            return users.findById(id).orElseThrow().toDto();
        } catch (DuplicateKeyException ex) {
            throw ApiException.conflict("Email already registered");
        }
    }

    @Transactional
    public LoginResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        UserRecord user = users.findByEmail(email).orElse(null);
        // Same message for unknown e-mail and wrong password (no account enumeration).
        if (user == null || !encoder.matches(req.password(), user.passwordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, BAD_CREDENTIALS);
        }
        if (!user.active()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This account is disabled. Contact an administrator.");
        }
        if (user.role() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "This account has an unknown role. Contact an administrator.");
        }
        users.touchLastLogin(user.id());
        JwtService.IssuedToken token = jwt.issue(user.toPrincipal());
        UserDto dto = users.findById(user.id()).orElseThrow().toDto();
        return new LoginResponse(token.token(), "Bearer", token.expiresAt(), dto);
    }

    public UserDto me(int userId) {
        return users.findById(userId).filter(UserRecord::active).map(UserRecord::toDto)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Session is no longer valid."));
    }
}
