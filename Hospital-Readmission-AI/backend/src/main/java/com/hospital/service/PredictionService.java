package com.hospital.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.dto.PredictionDtos.Factor;
import com.hospital.dto.PredictionDtos.PredictionResult;
import com.hospital.dto.PredictionSummary;
import com.hospital.exception.ApiException;
import com.hospital.repository.AdmissionRepository;
import com.hospital.repository.AdmissionRepository.AdmissionRef;
import com.hospital.repository.PatientRepository;
import com.hospital.repository.PredictionRepository;
import com.hospital.repository.PredictionRepository.StoredPrediction;
import com.hospital.util.RiskLevels;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

/**
 * Scores one stored admission with the ML service and stores the result in dbo.Predictions.
 * Nothing is estimated locally: if the ML service cannot score, the request fails with 503.
 */
@Service
public class PredictionService {

    private final AdmissionRepository admissions;
    private final PatientRepository patients;
    private final PredictionRepository predictions;
    private final MlServiceClient ml;
    private final NotificationService notifications;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;

    public PredictionService(AdmissionRepository admissions, PatientRepository patients, PredictionRepository predictions,
                             MlServiceClient ml, NotificationService notifications, ObjectMapper mapper,
                             TransactionTemplate tx) {
        this.admissions = admissions;
        this.patients = patients;
        this.predictions = predictions;
        this.ml = ml;
        this.notifications = notifications;
        this.mapper = mapper;
        this.tx = tx;
    }

    /** The ML call runs outside any transaction; storing the prediction and its alerts is one transaction. */
    public PredictionResult predict(long admissionId) {
        AdmissionRef ref = admissions.findRef(admissionId).orElseThrow(() -> ApiException.notFound("Admission " + admissionId));
        if (ref.expiredAtDischarge()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "This admission ended in death (expired at discharge); a readmission prediction does not apply.");
        }
        Map<String, Object> features = admissions.findFeatures(admissionId);
        MlServiceClient.MlResult result = ml.predict(admissionId, features);

        String factorsJson = factorsJson(result.factors());
        StoredPrediction stored = tx.execute(status -> {
            StoredPrediction saved = predictions.insert(admissionId, result.riskScore(), result.riskLevelDb(),
                    result.modelVersion(), factorsJson);
            if ("HIGH".equals(saved.riskLevelDb())) {
                notifications.notifyClinicalStaff(ref.patientId(), NotificationService.HIGH_RISK,
                        "Patient " + ref.externalPatientId() + " (admission " + admissionId + ") scored "
                                + RiskLevels.percent(saved.riskScore()) + "% 30-day readmission risk (model "
                                + saved.modelVersion() + "). Schedule a follow-up.");
            }
            return saved;
        });
        if (stored == null) throw new IllegalStateException("Prediction was not stored");
        Integer percent = RiskLevels.percent(stored.riskScore());
        return new PredictionResult(stored.predictionId(), ref.patientId(), ref.externalPatientId(), admissionId, percent,
                stored.riskScore(), RiskLevels.label(stored.riskLevelDb()), stored.modelVersion(), stored.predictedAt(),
                result.factors(), recommendedAction(stored.riskLevelDb()));
    }

    public List<PredictionSummary> forPatient(long patientId) {
        if (!patients.exists(patientId)) throw ApiException.notFound("Patient " + patientId);
        return predictions.findByPatient(patientId);
    }

    /**
     * Follow-up protocol shown with a prediction. It is a fixed care-pathway text per risk tier
     * (not a model output) and matches the due dates the UI proposes (7 / 14 / 30 days).
     */
    static String recommendedAction(String riskLevelDb) {
        return switch (riskLevelDb) {
            case "HIGH" -> "High risk: schedule a post-discharge follow-up within 7 days, reconcile medications "
                    + "and confirm the patient understands the discharge plan.";
            case "MEDIUM" -> "Medium risk: schedule a follow-up within 14 days and review medications and "
                    + "outstanding test results.";
            default -> "Low risk: routine follow-up within 30 days according to the standard discharge plan.";
        };
    }

    private String factorsJson(List<Factor> factors) {
        if (factors == null || factors.isEmpty()) return null;
        try {
            return mapper.writeValueAsString(factors);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialise model factors", ex);
        }
    }
}
