package com.hospital;

import com.hospital.dto.Request.PredictionRequestDto;
import com.hospital.dto.Response.PredictionResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
@Slf4j
public class MlPredictionClient {

    private final RestTemplate restTemplate;

    @Value("${ml.service.url:http://localhost:8000/api/predict}")
    private String mlServiceUrl;

    public MlInferenceResponseDto getPredictionFromMlModel(PredictionRequestDto requestDto) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<PredictionRequestDto> entity = new HttpEntity<>(requestDto, headers);

            ResponseEntity<MlInferenceResponseDto> response = restTemplate.postForEntity(
                    mlServiceUrl, entity, MlInferenceResponseDto.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            } else {
                throw new RuntimeException("ML Model returned non-success status code.");
            }
        } catch (RestClientException e) {
            log.error("Failed to connect to ML inference service at {}: {}", mlServiceUrl, e.getMessage());
            throw new RuntimeException("ML Prediction Service is currently unavailable. Please try again later.");
        }
    }

    // Inner DTO matching Python ML microservice response structure
    @lombok.Data
    public static class MlInferenceResponseDto {
        private double probability; // 0.0 to 1.0
        private String modelVersion;
        private java.util.List<PredictionResponseDto.ContributingFactorDto> contributingFactors;
        private java.util.List<String> recommendedActions;
    }
}