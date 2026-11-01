package com.hospital.controller;

import com.hospital.dto.HealthResponse;
import com.hospital.service.MlServiceClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Health endpoints. With context-path /api these are:
 *   GET /api/health          -> backend status
 *   GET /api/health/ml       -> backend -> ML service connectivity check
 */
@RestController
public class HealthController {

    private final MlServiceClient mlServiceClient;

    public HealthController(MlServiceClient mlServiceClient) {
        this.mlServiceClient = mlServiceClient;
    }

    @GetMapping("/health")
    public HealthResponse health() {
        return new HealthResponse("UP", "backend-java", Instant.now().toString());
    }

    @GetMapping("/health/ml")
    public Map<String, Object> mlHealth() {
        return mlServiceClient.checkHealth();
    }
}
