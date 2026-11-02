package com.hospital.service;

import com.hospital.config.AppProperties;
import com.hospital.dto.PredictionDtos.Factor;
import com.hospital.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Client for the FastAPI ML service (ml-service/, POST /ml/predict).
 *
 * Request: the fields of the agreed PredictionRequest schema (admission_id, gender, length_of_stay,
 * num_prior_admissions, num_diagnoses, num_medications) plus "features": the admission row with the
 * column names of dbo.vw_AdmissionFeatures. Pydantic ignores unknown fields, so the extra block is
 * backward compatible.
 * Response: admission_id, risk_score (0-1), risk_level (LOW/MEDIUM/HIGH), model_version and,
 * optionally, top_factors [{feature|label, contribution}].
 *
 * There is no fallback score: when the service is down or has no model, callers get HTTP 503.
 */
@Service
public class MlServiceClient {

    private static final Logger log = LoggerFactory.getLogger(MlServiceClient.class);

    private final RestClient restClient;
    private final String baseUrl;

    public MlServiceClient(RestClient mlServiceRestClient, AppProperties props) {
        this.restClient = mlServiceRestClient;
        this.baseUrl = props.mlService().url();
    }

    public record MlResult(BigDecimal riskScore, String riskLevelDb, String modelVersion, List<Factor> factors) {
    }

    public Map<String, Object> checkHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            Map<String, Object> body = restClient.get().uri("/ml/health").retrieve()
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

    public MlResult predict(long admissionId, Map<String, Object> features) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("admission_id", admissionId);
        request.put("gender", features.get("GenderAtAdmission"));
        request.put("length_of_stay", features.get("LengthOfStayDays"));
        request.put("num_prior_admissions", features.get("NumPriorAdmissions"));
        request.put("num_diagnoses", features.get("NumDiagnoses"));
        request.put("num_medications", features.get("NumMedications"));
        request.put("features", features);

        Map<String, Object> body;
        try {
            body = restClient.post().uri("/ml/predict").contentType(MediaType.APPLICATION_JSON).body(request)
                    .retrieve().body(new ParameterizedTypeReference<Map<String, Object>>() {});
        } catch (ResourceAccessException ex) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "The ML prediction service is not reachable at " + baseUrl
                            + ". Start ml-service (uvicorn app.main:app --port 8000) and try again.", ex);
        } catch (HttpStatusCodeException ex) {
            String detail = ex.getResponseBodyAsString();
            if (detail.length() > 300) detail = detail.substring(0, 300);
            if (ex.getStatusCode().value() == 501 || ex.getStatusCode().value() == 503) {
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                        "The ML service has no trained model available yet (HTTP " + ex.getStatusCode().value()
                                + "). No prediction was stored.", ex);
            }
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "The ML service rejected the request (HTTP " + ex.getStatusCode().value() + "): " + detail, ex);
        } catch (RestClientException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Invalid response from the ML service: " + ex.getMessage(), ex);
        }
        return parse(admissionId, body);
    }

    static MlResult parse(long admissionId, Map<String, Object> body) {
        if (body == null) throw invalid("empty body");
        Object id = body.get("admission_id");
        if (id instanceof Number n && n.longValue() != admissionId) {
            throw invalid("admission_id " + n + " does not match the requested " + admissionId);
        }
        if (!(body.get("risk_score") instanceof Number scoreNumber)) throw invalid("risk_score missing");
        double score = scoreNumber.doubleValue();
        if (Double.isNaN(score) || score < 0 || score > 1) throw invalid("risk_score " + score + " is outside 0-1");
        String level = body.get("risk_level") == null ? null : body.get("risk_level").toString().toUpperCase(Locale.ROOT);
        if (!"LOW".equals(level) && !"MEDIUM".equals(level) && !"HIGH".equals(level)) {
            throw invalid("risk_level must be LOW, MEDIUM or HIGH");
        }
        Object version = body.get("model_version");
        if (version == null || version.toString().isBlank()) throw invalid("model_version missing");
        String modelVersion = version.toString();
        if (modelVersion.length() > 50) modelVersion = modelVersion.substring(0, 50);

        List<Factor> factors = new ArrayList<>();
        if (body.get("top_factors") instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    Object label = m.get("label") != null ? m.get("label") : m.get("feature");
                    Object contribution = m.get("contribution");
                    if (label != null && contribution instanceof Number c) {
                        factors.add(new Factor(label.toString(), c.doubleValue()));
                    }
                }
            }
        }
        // DECIMAL(5,4) in dbo.Predictions
        BigDecimal stored = BigDecimal.valueOf(score).setScale(4, RoundingMode.HALF_UP);
        return new MlResult(stored, level, modelVersion, factors);
    }

    private static ApiException invalid(String what) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "Invalid response from the ML service: " + what + ".");
    }
}
