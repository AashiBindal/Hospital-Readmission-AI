package com.hospital.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Typed binding for the custom "app.*" properties in application.properties.
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(MlService mlService, Cors cors) {

    public record MlService(String url, Integer timeoutMs) {
        public MlService {
            if (url == null || url.isBlank()) url = "http://localhost:8000";
            if (timeoutMs == null) timeoutMs = 10000;
        }
    }

    public record Cors(List<String> allowedOrigins) {
        public Cors {
            if (allowedOrigins == null || allowedOrigins.isEmpty()) {
                allowedOrigins = List.of("http://localhost:5173");
            }
        }
    }

    public AppProperties {
        if (mlService == null) mlService = new MlService(null, null);
        if (cors == null) cors = new Cors(null);
    }
}
