package com.hospital.service;

public interface EmailService {
    void sendOtpEmail(String toEmail, String otp);
}