package com.hospital.service.ServiceImpl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.MlPredictionClient;               // consider moving to com.hospital.client
import com.hospital.dto.Request.PredictionRequestDto;
import com.hospital.dto.Response.PredictionResponseDto;
import com.hospital.entity.PatientHospitalRecord;
import com.hospital.entity.PredictionHistory;
import com.hospital.repository.PatientHospitalRecordRepository;
import com.hospital.repository.PredictionHistoryRepository;
import com.hospital.service.PredictionService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * LEGACY prediction flow (patient_hospital_records / prediction_histories).
 * Kept working for now; the new flow lives in RiskPredictionServiceImpl.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PredictionServiceImpl implements PredictionService {

    private static final double HIGH_RISK_THRESHOLD = 0.70;
    private static final double MEDIUM_RISK_THRESHOLD = 0.40;
    private static final String MANUAL_ENTRY = "MANUAL_ENTRY";
    private static final String DEFAULT_MODEL_VERSION = "v1.0.0";

    private final MlPredictionClient mlClient;
    private final PredictionHistoryRepository historyRepository;
    private final PatientHospitalRecordRepository patientRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate; // auto-configured by Spring Boot
    private final Validator validator;

    // No @Transactional here: the slow HTTP call to the ML service must not hold a DB
    // connection open. Only the database writes run inside a transaction (see runPrediction).
    @Override
    public PredictionResponseDto predictReadmission(PredictionRequestDto dto) {
        // Manual entry: not linked to any legacy record.
        return runPrediction(dto, null, null);
    }

    @Override
    public PredictionResponseDto predictForExistingPatient(Long patientDbId) {
        PatientHospitalRecord patient = patientRepository.findById(patientDbId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Patient not found with database ID: " + patientDbId));

        // Unknown is not zero: refuse to predict on data we do not actually have.
        List<String> missing = new ArrayList<>();
        List<String> medicines = parseItems(patient.getMedicines());
        List<String> chronic = parseItems(patient.getChronicDiseases());
        if (medicines.isEmpty()) missing.add("medicines");
        if (chronic.isEmpty()) missing.add("chronic diseases");
        if (patient.getDischargeType() == null || patient.getDischargeType().isBlank()) {
            missing.add("discharge type");
        }
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Cannot predict: record has no data for " + String.join(", ", missing) + ".");
        }

        PredictionRequestDto dto = new PredictionRequestDto();
        // patientId (UUID) intentionally left null: legacy records use a String id,
        // which is passed separately below and is not sent to the ML service.
        dto.setAge(patient.getAge());
        dto.setGender(patient.getGender());
        dto.setPrimaryDiagnosis(patient.getPrimaryDiagnosis());
        dto.setPriorAdmissions(patient.getPreviousAdmissions());
        dto.setLengthOfStay(Math.toIntExact(patient.getLengthOfStay()));
        dto.setMedicationsCount(medicines.size());
        dto.setComorbiditiesCount(chronic.size());
        dto.setChronicDiseases(chronic);
        dto.setDischargeType(patient.getDischargeType());

        // Pass the exact DB id so we update THIS admission record, not an arbitrary one
        return runPrediction(dto, patientDbId, patient.getPatientId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<PredictionHistory> getPatientPredictionHistory(String patientId) {
        if (patientId == null || patientId.isBlank()) {
            throw new IllegalArgumentException("patientId must not be blank.");
        }
        return historyRepository.findByPatientIdOrderByPredictionTimestampDesc(patientId.trim());
    }

    // ---------------------------------------------------------------------

    private PredictionResponseDto runPrediction(PredictionRequestDto dto, Long patientDbId, String legacyPatientId) {
        if (dto == null) {
            throw new IllegalArgumentException("Prediction request must not be null.");
        }
        validateOrReject(dto);

        // 1. ML call, outside any transaction
        MlPredictionClient.MlInferenceResponseDto mlResult = mlClient.getPredictionFromMlModel(dto);
        if (mlResult == null) {
            throw new IllegalStateException("ML service returned no result.");
        }

        double probability = mlResult.getProbability();
        if (Double.isNaN(probability) || Double.isInfinite(probability) || probability < 0.0 || probability > 1.0) {
            throw new IllegalStateException("ML service returned an invalid probability: " + probability);
        }

        PatientHospitalRecord.RiskLevel category = classifyRiskLevel(probability);

        String patientId = legacyPatientId != null && !legacyPatientId.isBlank()
                ? legacyPatientId.trim()
                : MANUAL_ENTRY;

        PredictionHistory history = PredictionHistory.builder()
                .patientId(patientId)
                .modelVersion(mlResult.getModelVersion() != null ? mlResult.getModelVersion() : DEFAULT_MODEL_VERSION)
                .riskProbability(probability)
                .riskCategory(category)
                .contributingFactors(toJson(mlResult.getContributingFactors(), "[]"))
                .recommendedActions(toJson(mlResult.getRecommendedActions(), "[]"))
                .predictionTimestamp(LocalDateTime.now())
                .inputSnapshot(toJson(dto, "{}"))
                .build();

        // 2. History + patient update commit or roll back together
        PredictionHistory savedHistory = transactionTemplate.execute(status -> {
            PredictionHistory saved = historyRepository.save(history);
            if (patientDbId != null) {
                patientRepository.findById(patientDbId)
                        .ifPresent(p -> applyRisk(p, category, probability));
            }
            return saved;
        });

        // 3. Build response
        List<PredictionResponseDto.ContributingFactorDto> mappedFactors = new ArrayList<>();
        if (mlResult.getContributingFactors() != null) {
            for (var factor : mlResult.getContributingFactors()) {
                PredictionResponseDto.ContributingFactorDto mapped = new PredictionResponseDto.ContributingFactorDto();
                mapped.setFeatureName(factor.getFeatureName());
                mapped.setImpactDescription(factor.getImpactDescription());
                mapped.setImportanceScore(factor.getImportanceScore());
                mappedFactors.add(mapped);
            }
        }

        return PredictionResponseDto.builder()
                .predictionId(null) // legacy history id is a Long; response id is a UUID (new flow only)
                .patientId(savedHistory.getPatientId())
                .riskProbabilityPercentage(BigDecimal.valueOf(Math.round(probability * 100.0 * 100.0) / 100.0))
                .riskCategory(category)
                .modelVersion(savedHistory.getModelVersion())
                .contributingFactors(mappedFactors)
                .recommendedActions(mlResult.getRecommendedActions() != null
                        ? mlResult.getRecommendedActions()
                        : Collections.emptyList())
                .predictionTimestamp(savedHistory.getPredictionTimestamp())
                .build();
    }

    /** Applies the same bean-validation rules the controller enforces to internally built requests. */
    private void validateOrReject(PredictionRequestDto dto) {
        Set<ConstraintViolation<PredictionRequestDto>> violations = validator.validate(dto);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(ConstraintViolation::getMessage)
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
        }
    }

    /** Runs inside the TransactionTemplate; dirty checking flushes the changes on commit. */
    private void applyRisk(PatientHospitalRecord patient,
                           PatientHospitalRecord.RiskLevel category, double probability) {
        patient.setRiskLevel(category);
        patient.setRiskScore(probability);
        patientRepository.save(patient);
    }

    private String toJson(Object value, String fallback) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize prediction metadata JSON: {}", e.getMessage());
            return fallback;
        }
    }

    private List<String> parseItems(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    private PatientHospitalRecord.RiskLevel classifyRiskLevel(double probability) {
        if (probability >= HIGH_RISK_THRESHOLD) return PatientHospitalRecord.RiskLevel.HIGH;
        if (probability >= MEDIUM_RISK_THRESHOLD) return PatientHospitalRecord.RiskLevel.MEDIUM;
        return PatientHospitalRecord.RiskLevel.LOW;
    }
}