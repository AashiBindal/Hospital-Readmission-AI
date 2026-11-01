package com.hospital.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thin client for the FastAPI ML service.
 * TODO (Member 2 + Member 3): add predict() once /ml/predict contract is agreed.
 */
@Service
public class MlServiceClient {

    private static final Logger log = LoggerFactory.getLogger(MlServiceClient.class);
    private final RestClient restClient;

    public MlServiceClient(RestClient mlServiceRestClient) {
        this.restClient = mlServiceRestClient;
    }

    public Map<String, Object> checkHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            Map<String, Object> body = restClient.get()
                    .uri("/ml/health")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            result.put("mlService", "UP");
            result.put("response", body);
        } catch (RestClientException ex) {
            log.warn("ML service health check failed: {}", ex.getMessage());
            result.put("mlService", "DOWN");
            result.put("error", ex.getMessage());
        }
        return result;
    }
}
