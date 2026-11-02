package com.hospital.service;

import com.hospital.dto.Request.ForgotPasswordRequestDto;
import com.hospital.dto.Request.ResetPasswordRequestDto;
import com.hospital.dto.Request.VerifyOtpRequestDto;

public interface ForgotPasswordService {
    String requestOtp(ForgotPasswordRequestDto requestDto);
    boolean verifyOtp(VerifyOtpRequestDto requestDto);
    String resendOtp(ForgotPasswordRequestDto requestDto);
    String resetPassword(ResetPasswordRequestDto requestDto);
}