package com.hospital.service;

import com.hospital.exception.ApiException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MlServiceClientParseTest {

    @Test
    void acceptsAValidResponseAndRoundsToTheDatabaseScale() {
        MlServiceClient.MlResult r = MlServiceClient.parse(7, Map.of(
                "admission_id", 7, "risk_score", 0.763449, "risk_level", "high", "model_version", "rf-1.0",
                "top_factors", List.of(Map.of("feature", "NumPriorAdmissions", "contribution", 0.21))));
        assertEquals(new BigDecimal("0.7634"), r.riskScore());
        assertEquals("HIGH", r.riskLevelDb());
        assertEquals("rf-1.0", r.modelVersion());
        assertEquals(1, r.factors().size());
        assertEquals("NumPriorAdmissions", r.factors().get(0).label());
    }

    @Test
    void factorsAreOptional() {
        MlServiceClient.MlResult r = MlServiceClient.parse(7, Map.of(
                "admission_id", 7, "risk_score", 0.1, "risk_level", "LOW", "model_version", "v"));
        assertTrue(r.factors().isEmpty());
    }

    @Test
    void rejectsOutOfRangeOrInconsistentResponses() {
        assertThrows(ApiException.class, () -> MlServiceClient.parse(7, Map.of(
                "admission_id", 7, "risk_score", 1.5, "risk_level", "HIGH", "model_version", "v")));
        assertThrows(ApiException.class, () -> MlServiceClient.parse(7, Map.of(
                "admission_id", 8, "risk_score", 0.5, "risk_level", "HIGH", "model_version", "v")));
        assertThrows(ApiException.class, () -> MlServiceClient.parse(7, Map.of(
                "admission_id", 7, "risk_score", 0.5, "risk_level", "SEVERE", "model_version", "v")));
        assertThrows(ApiException.class, () -> MlServiceClient.parse(7, Map.of(
                "admission_id", 7, "risk_score", 0.5, "risk_level", "LOW")));
        assertThrows(ApiException.class, () -> MlServiceClient.parse(7, null));
    }
}
