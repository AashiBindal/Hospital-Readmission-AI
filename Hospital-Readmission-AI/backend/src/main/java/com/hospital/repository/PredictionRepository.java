
package com.hospital.repository;

import com.hospital.dto.PredictionSummary;
import com.hospital.util.RiskLevels;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class PredictionRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public PredictionRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record StoredPrediction(
            long predictionId,
            long admissionId,
            BigDecimal riskScore,
            String riskLevelDb,
            String modelVersion,
            String topFactorsJson,
            LocalDateTime predictedAt
    ) {
    }

    public StoredPrediction insert(
            long admissionId,
            BigDecimal riskScore,
            String riskLevelDb,
            String modelVersion,
            String topFactorsJson
    ) {
        String sql = """
                INSERT INTO public."Predictions"
                    ("AdmissionId", "RiskScore", "RiskLevel",
                     "ModelVersion", "TopFactors")
                VALUES
                    (:aid, :score, :level, :model, :factors)
                RETURNING
                    "PredictionId", "AdmissionId", "RiskScore",
                    "RiskLevel", "ModelVersion", "TopFactors",
                    "PredictedAt"
                """;

        return jdbc.queryForObject(
                sql,
                new MapSqlParameterSource()
                        .addValue("aid", admissionId)
                        .addValue("score", riskScore)
                        .addValue("level", riskLevelDb)
                        .addValue("model", modelVersion)
                        .addValue("factors", topFactorsJson),
                (rs, i) -> new StoredPrediction(
                        rs.getLong("PredictionId"),
                        rs.getLong("AdmissionId"),
                        rs.getBigDecimal("RiskScore"),
                        rs.getString("RiskLevel"),
                        rs.getString("ModelVersion"),
                        rs.getString("TopFactors"),
                        Jdbc.local(rs.getTimestamp("PredictedAt"))
                )
        );
    }

    public List<PredictionSummary> findByPatient(long patientId) {
        String sql = """
                SELECT
                    pr."PredictionId",
                    pr."AdmissionId",
                    pr."RiskScore",
                    pr."RiskLevel",
                    pr."ModelVersion",
                    pr."PredictedAt"
                FROM public."Predictions" pr
                JOIN public."Admissions" a
                    ON a."AdmissionId" = pr."AdmissionId"
                WHERE a."PatientId" = :pid
                ORDER BY
                    pr."PredictedAt" DESC,
                    pr."PredictionId" DESC
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("pid", patientId),
                (rs, i) -> new PredictionSummary(
                        rs.getLong("PredictionId"),
                        rs.getLong("AdmissionId"),
                        RiskLevels.percent(rs.getBigDecimal("RiskScore")),
                        RiskLevels.label(rs.getString("RiskLevel")),
                        rs.getString("ModelVersion"),
                        Jdbc.local(rs.getTimestamp("PredictedAt"))
                )
        );
    }

    /**
     * Patient id of a prediction.
     * Used to check whether a follow-up's predictionId
     * belongs to the specified patient.
     */
    public Optional<Long> findPatientId(long predictionId) {
        String sql = """
                SELECT a."PatientId"
                FROM public."Predictions" pr
                JOIN public."Admissions" a
                    ON a."AdmissionId" = pr."AdmissionId"
                WHERE pr."PredictionId" = :id
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("id", predictionId),
                (rs, i) -> rs.getLong("PatientId")
        ).stream().findFirst();
    }
}
