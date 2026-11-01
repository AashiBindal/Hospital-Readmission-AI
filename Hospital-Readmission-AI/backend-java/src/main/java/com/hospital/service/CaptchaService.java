package com.hospital.service;

public interface CaptchaService {
    boolean verifyCaptcha(String captchaResponse);
}