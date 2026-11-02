package com.hospital.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Typed binding for the custom "app.*" properties (see application.properties).
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cors cors, MlService mlService, Upload upload, Etl etl, Bootstrap bootstrap) {

    public record Jwt(String secret, Integer expirationMinutes) {
        public Jwt {
            if (expirationMinutes == null || expirationMinutes <= 0) expirationMinutes = 480;
        }
    }

    public record Cors(List<String> allowedOrigins) {
        public Cors {
            if (allowedOrigins == null || allowedOrigins.isEmpty()) allowedOrigins = List.of("http://localhost:3000");
        }
    }

    public record MlService(String url, Integer timeoutMs) {
        public MlService {
            if (url == null || url.isBlank()) url = "http://localhost:8000";
            if (timeoutMs == null || timeoutMs <= 0) timeoutMs = 10000;
        }
    }

    public record Upload(String dir) {
        public Upload {
            if (dir == null || dir.isBlank()) dir = "./uploads";
        }
    }

    public record Etl(Boolean enabled, String python, String workingDir, String mappingsFile, Integer timeoutMinutes) {
        public Etl {
            if (enabled == null) enabled = false;
            if (python == null || python.isBlank()) python = "python";
            if (workingDir == null || workingDir.isBlank()) workingDir = "../etl";
            if (timeoutMinutes == null || timeoutMinutes <= 0) timeoutMinutes = 30;
        }
    }

    public record Bootstrap(String adminEmail, String adminPassword, String adminName) {
    }

    public AppProperties {
        if (jwt == null) jwt = new Jwt(null, null);
        if (cors == null) cors = new Cors(null);
        if (mlService == null) mlService = new MlService(null, null);
        if (upload == null) upload = new Upload(null);
        if (etl == null) etl = new Etl(null, null, null, null, null);
        if (bootstrap == null) bootstrap = new Bootstrap(null, null, null);
    }
}
