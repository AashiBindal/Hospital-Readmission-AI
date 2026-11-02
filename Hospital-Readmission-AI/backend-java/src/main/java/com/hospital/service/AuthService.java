package com.hospital.service;


import com.hospital.dto.Request.LoginRequestDto;
import com.hospital.dto.Request.RegisterRequestDto;
import com.hospital.dto.Response.UserResponseDto;

public interface AuthService {
    UserResponseDto register(RegisterRequestDto request);
    String login(LoginRequestDto request);
}