package com.hospital.service.ServiceImpl;

import com.hospital.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Override
    public void sendOtpEmail(String toEmail, String otp) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Password Reset OTP - Hospital Management System");
        message.setText("Your OTP for password reset is: " + otp + "\nThis OTP is valid for 5 minutes. Do not share it with anyone.");
        mailSender.send(message);
    }
}