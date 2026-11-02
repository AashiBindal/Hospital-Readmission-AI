package com.hospital.controller;

import com.hospital.dto.AuthDtos.LoginRequest;
import com.hospital.dto.AuthDtos.LoginResponse;
import com.hospital.dto.AuthDtos.RegisterRequest;
import com.hospital.dto.AuthDtos.RegisterResponse;
import com.hospital.dto.UserDto;
import com.hospital.security.CurrentUser;
import com.hospital.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        return new RegisterResponse("Registration successful. You can now sign in.", auth.register(request));
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @GetMapping("/me")
    public UserDto me() {
        return auth.me(CurrentUser.get().id());
    }
}
