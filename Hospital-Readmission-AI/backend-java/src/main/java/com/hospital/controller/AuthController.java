package com.hospital.controller;

import com.hospital.dto.Request.LoginRequestDto;
import com.hospital.dto.Request.RegisterRequestDto;
import com.hospital.dto.Response.UserResponseDto;
import com.hospital.service.ServiceImpl.AuthServiceImpl;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthServiceImpl authService;

    @PostMapping("/register")
    public ResponseEntity<UserResponseDto> register(@Valid @RequestBody RegisterRequestDto requestDto) {
        UserResponseDto response = authService.register(requestDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@Valid @RequestBody LoginRequestDto requestDto) {
        String token = authService.login(requestDto);
        return ResponseEntity.ok(token);
    }
}