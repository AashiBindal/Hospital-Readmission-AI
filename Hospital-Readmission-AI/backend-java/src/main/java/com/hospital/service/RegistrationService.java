package com.hospital.service;

import com.hospital.dto.Request.UserRegistrationDto;

public interface RegistrationService {
    String registerUser(UserRegistrationDto dto);
}