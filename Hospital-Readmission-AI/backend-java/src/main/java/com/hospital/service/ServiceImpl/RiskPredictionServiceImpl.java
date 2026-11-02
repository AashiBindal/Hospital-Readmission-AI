package com.hospital.service.ServiceImpl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.MlPredictionClient;
import com.hospital.dto.Request.PredictionRequestDto;
import com.hospital.dto.Response.PredictionResponseDto;
import com.hospital.entity.Patient;
import com.hospital.entity.PatientHospitalRecord;
import com.hospital.entity.PredictionFactor;
import com.hospital.entity.RiskPrediction;
import com.hospital.repository.PatientRepository;
import com.hospital.repository.RiskPredictionRepository;
import com.hospital.service.RiskPredictionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RiskPredictionServiceImpl implements RiskPredictionService {

    private static final double HIGH_RISK_THRESHOLD = 0.70;
    private static final double MEDIUM_RISK_THRESHOLD = 0.40;
    private static final String UNKNOWN_MODEL_VERSION = "unknown";
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    private final RiskPredictionRepository riskPredictionRepository;
    private final PatientRepository patientRepository;
    private final MlPredictionClient mlPredictionClient;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    @Override
    public PredictionResponseDto predictReadmission(PredictionRequestDto dto) {
        if (dto == null) {
            throw new IllegalArgumentException("Prediction request must not be null.");
        }

        // Safely parse patientId (handling both String and UUID DTO types)
        UUID patientId = null;
        if (dto.getPatientId() != null) {
            try {
                patientId = dto.getPatientId() instanceof UUID
                        ? (UUID) dto.getPatientId()
                        : dto.getPatientId();
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid patient ID format: " + dto.getPatientId());
            }

            if (!patientRepository.existsById(patientId)) {
                throw new IllegalArgumentException("Patient not found with ID: " + patientId);
            }
        }

        // Call ML model outside transaction
        MlPredictionClient.MlInferenceResponseDto mlResult = mlPredictionClient.getPredictionFromMlModel(dto);
        validateMlResult(mlResult);

        // Short write transaction
        UUID finalPatientId = patientId;
        return transactionTemplate.execute(status -> persist(dto, finalPatientId, mlResult));
    }

    private PredictionResponseDto persist(PredictionRequestDto dto,
                                          UUID patientId,
                                          MlPredictionClient.MlInferenceResponseDto mlResult) {
        Patient patient = null;
        String patientName = "Standalone Evaluation";

        if (patientId != null) {
            patient = patientRepository.findById(patientId)
                    .orElseThrow(() -> new IllegalArgumentException("Patient not found with ID: " + patientId));
            patientName = patient.getName();
        }

        double rawProbability = mlResult.getProbability();
        Double percentage = (double) BigDecimal.valueOf(rawProbability)
                .multiply(ONE_HUNDRED)
                .scale();
        RiskPrediction.RiskLevel riskLevel = classifyRiskLevel(rawProbability);

        RiskPrediction prediction = RiskPrediction.builder()
                .patient(patient)
                .patientName(patientName)
                .age(dto.getAge())
                .gender(convertEnumString(RiskPrediction.Gender.class, dto.getGender(), "gender"))
                .primaryDiagnosis(dto.getPrimaryDiagnosis())
                .priorAdmissions(dto.getPriorAdmissions())
                .lengthOfStay((int) dto.getLengthOfStay()) // Handles long to int conversion safely
                .medicationsCount(dto.getMedicationsCount())
                .chronicDiseases(toJson(
                        dto.getChronicDiseases() != null ? dto.getChronicDiseases() : Collections.emptyList(),
                        "chronic diseases"))
                .dischargeType(convertEnumString(RiskPrediction.DischargeType.class, dto.getDischargeType(), "dischargeType"))
                .probability(BigDecimal.valueOf(percentage))
                .riskLevel(riskLevel)
                .recommendedAction(mlResult.getRecommendedActions() != null
                        ? String.join("; ", mlResult.getRecommendedActions())
                        : "")
                .modelVersion(mlResult.getModelVersion() != null && !mlResult.getModelVersion().isBlank()
                        ? mlResult.getModelVersion()
                        : UNKNOWN_MODEL_VERSION)
                .predictedAt(LocalDateTime.now())
                .inputSnapshot(toJson(dto, "input snapshot"))
                .build();

        prediction.setFactors(buildFactors(prediction, mlResult));

        RiskPrediction saved = riskPredictionRepository.save(prediction);

        if (patient != null) {
            patient.setRiskScore(BigDecimal.valueOf(percentage));
            patient.setRiskLevel(convertEnumDirect(Patient.RiskLevel.class, riskLevel.name(), "riskLevel"));
            patientRepository.save(patient);
        }

        return mapToDto(saved);
    }

    private List<PredictionFactor> buildFactors(RiskPrediction prediction,
                                                MlPredictionClient.MlInferenceResponseDto mlResult) {
        List<PredictionFactor> factors = new ArrayList<>();
        if (mlResult.getContributingFactors() == null) {
            return factors;
        }
        for (var f : mlResult.getContributingFactors()) {
            Double score = f.getImportanceScore();
            factors.add(PredictionFactor.builder()
                    .riskPrediction(prediction)
                    .factorName(f.getFeatureName())
                    .factorValue(f.getImpactDescription())
                    .contribution(score != null ? BigDecimal.valueOf(score) : BigDecimal.ZERO)
                    .explanation(f.getImpactDescription())
                    .build());
        }
        return factors;
    }

    private void validateMlResult(MlPredictionClient.MlInferenceResponseDto mlResult) {
        if (mlResult == null) {
            throw new IllegalStateException("ML service returned no response.");
        }
        double p = mlResult.getProbability();
        if (Double.isNaN(p) || Double.isInfinite(p) || p < 0.0 || p > 1.0) {
            throw new IllegalStateException("ML service returned an invalid probability: " + p);
        }
    }

    private RiskPrediction.RiskLevel classifyRiskLevel(double probability) {
        if (probability >= HIGH_RISK_THRESHOLD) {
            return RiskPrediction.RiskLevel.HIGH;
        } else if (probability >= MEDIUM_RISK_THRESHOLD) {
            return RiskPrediction.RiskLevel.MEDIUM;
        }
        return RiskPrediction.RiskLevel.LOW;
    }

    private String toJson(Object value, String description) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize {} for risk prediction", description, e);
            throw new IllegalStateException("Could not serialize " + description, e);
        }
    }

    // Handles String values coming from DTO (e.g., "MALE", "HOME_SELF_CARE")
    private static <E extends Enum<E>> E convertEnumString(Class<E> target, String source, String fieldName) {
        if (source == null || source.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
        try {
            return Enum.valueOf(target, source.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unsupported " + fieldName + " value: " + source, e);
        }
    }

    // Handles Enum-to-Enum mapping
    private static <E extends Enum<E>> E convertEnumDirect(Class<E> target, String sourceName, String fieldName) {
        if (sourceName == null) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
        try {
            return Enum.valueOf(target, sourceName);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unsupported " + fieldName + " value: " + sourceName, e);
        }
    }

    private PredictionResponseDto mapToDto(RiskPrediction p) {
        List<PredictionResponseDto.ContributingFactorDto> factorDtos = p.getFactors() == null
                ? new ArrayList<>()
                : p.getFactors().stream()
                .map(f -> PredictionResponseDto.ContributingFactorDto.builder()
                        .featureName(f.getFactorName())
                        .impactDescription(f.getExplanation())
                        .importanceScore(f.getContribution() != null ? f.getContribution().doubleValue() : 0.0)
                        .build())
                .collect(Collectors.toList());

        String resolvedPatientId = null;
        if (p.getPatient() != null && p.getPatient().getId() != null) {
            resolvedPatientId = p.getPatient().getId().toString();
        }

        return PredictionResponseDto.builder()
                .predictionId(p.getId())
                .patientId(resolvedPatientId)
                .patientName(p.getPatientName())
                .riskProbabilityPercentage(p.getProbability())
                .riskCategory(PatientHospitalRecord.RiskLevel.valueOf(p.getRiskLevel().name()))
                .modelVersion(p.getModelVersion())
                .recommendedActions(Collections.singletonList(p.getRecommendedAction()))
                .predictionTimestamp(p.getPredictedAt())
                .contributingFactors(factorDtos)
                .build();
    }
}