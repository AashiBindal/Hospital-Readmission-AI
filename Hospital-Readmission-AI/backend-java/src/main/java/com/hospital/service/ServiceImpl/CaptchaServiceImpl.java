package com.hospital.service.ServiceImpl;

import com.hospital.dto.Response.CaptchaResponseDto;
import com.hospital.service.CaptchaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Service
public class CaptchaServiceImpl implements CaptchaService {

    @Value("${google.recaptcha.secret}")
    private String recaptchaSecret;

    @Value("${google.recaptcha.verify-url}")
    private String recaptchaVerifyUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public boolean verifyCaptcha(String captchaResponse) {
        if (captchaResponse == null || captchaResponse.isBlank()) {
            return false;
        }

        MultiValueMap<String, String> requestParams = new LinkedMultiValueMap<>();
        requestParams.add("secret", recaptchaSecret);
        requestParams.add("response", captchaResponse);

        try {
            ResponseEntity<CaptchaResponseDto> response = restTemplate.postForEntity(
                    recaptchaVerifyUrl,
                    requestParams,
                    CaptchaResponseDto.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody().isSuccess();
            }
        } catch (Exception e) {
            // Log exception in production
        }
        return false;
    }
}