
package com.hospital.repository;

import com.hospital.dto.AdmissionDto;
import com.hospital.dto.PredictionSummary;
import com.hospital.util.DiagnosisCategories;
import com.hospital.util.RiskLevels;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class AdmissionRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public AdmissionRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Minimal facts about an admission used by the prediction workflow.
     */
    public record AdmissionRef(
            long admissionId,
            long patientId,
            String externalPatientId,
            boolean expiredAtDischarge
    ) {
    }

    private static final String SELECT = """
            SELECT
                a."AdmissionId",
                a."ExternalAdmissionId",
                a."UploadId",
                a."AgeGroup",
                a."GenderAtAdmission",
                a."RaceAtAdmission",
                a."Department",
                COALESCE(at."Description", a."AdmissionType") AS "AdmissionTypeText",
                COALESCE(src."Description", a."AdmissionSource") AS "AdmissionSourceText",
                COALESCE(dd."Description", a."DischargeDisposition") AS "DischargeDispositionText",
                a."LengthOfStayDays",
                a."PrimaryDiagnosisCode",
                a."SecondaryDiagnosisCode",
                a."TertiaryDiagnosisCode",
                a."NumDiagnoses",
                a."NumProcedures",
                a."NumMedications",
                a."NumLabTests",
                a."NumPriorAdmissions",
                a."NumEmergencyVisits",
                a."NumOutpatientVisits",
                a."A1CResult",
                a."MaxGluSerum",
                a."PayerCode",
                a."WeightRange",
                a."ReadmissionStatus",
                a."ExpiredAtDischarge",
                a."DischargedToHospice",
                pr."PredictionId",
                pr."RiskScore",
                pr."RiskLevel",
                pr."ModelVersion",
                pr."PredictedAt"
            FROM public."Admissions" a
            LEFT JOIN public."AdmissionTypes" at
                ON at."AdmissionTypeId" = a."AdmissionTypeId"
            LEFT JOIN public."AdmissionSources" src
                ON src."AdmissionSourceId" = a."AdmissionSourceId"
            LEFT JOIN public."DischargeDispositions" dd
                ON dd."DischargeDispositionId" = a."DischargeDispositionId"
            LEFT JOIN LATERAL (
                SELECT
                    x."PredictionId",
                    x."RiskScore",
                    x."RiskLevel",
                    x."ModelVersion",
                    x."PredictedAt"
                FROM public."Predictions" x
                WHERE x."AdmissionId" = a."AdmissionId"
                ORDER BY
                    x."PredictedAt" DESC,
                    x."PredictionId" DESC
                LIMIT 1
            ) pr ON TRUE
            """;

    private static final RowMapper<AdmissionDto> MAPPER = (rs, i) -> {
        long admissionId = rs.getLong("AdmissionId");
        Long predictionId = Jdbc.longOrNull(rs, "PredictionId");

        PredictionSummary latest = predictionId == null
                ? null
                : new PredictionSummary(
                predictionId,
                admissionId,
                RiskLevels.percent(rs.getBigDecimal("RiskScore")),
                RiskLevels.label(rs.getString("RiskLevel")),
                rs.getString("ModelVersion"),
                Jdbc.local(rs.getTimestamp("PredictedAt"))
        );

        String code = rs.getString("PrimaryDiagnosisCode");

        return new AdmissionDto(
                admissionId,
                rs.getString("ExternalAdmissionId"),
                Jdbc.longOrNull(rs, "UploadId"),
                rs.getString("AgeGroup"),
                rs.getString("GenderAtAdmission"),
                rs.getString("RaceAtAdmission"),
                rs.getString("Department"),
                rs.getString("AdmissionTypeText"),
                rs.getString("AdmissionSourceText"),
                rs.getString("DischargeDispositionText"),
                Jdbc.intOrNull(rs, "LengthOfStayDays"),
                code,
                rs.getString("SecondaryDiagnosisCode"),
                rs.getString("TertiaryDiagnosisCode"),
                code == null ? null : DiagnosisCategories.categorize(code),
                Jdbc.intOrNull(rs, "NumDiagnoses"),
                Jdbc.intOrNull(rs, "NumProcedures"),
                Jdbc.intOrNull(rs, "NumMedications"),
                Jdbc.intOrNull(rs, "NumLabTests"),
                Jdbc.intOrNull(rs, "NumPriorAdmissions"),
                Jdbc.intOrNull(rs, "NumEmergencyVisits"),
                Jdbc.intOrNull(rs, "NumOutpatientVisits"),
                rs.getString("A1CResult"),
                rs.getString("MaxGluSerum"),
                rs.getString("PayerCode"),
                rs.getString("WeightRange"),
                rs.getString("ReadmissionStatus"),
                rs.getBoolean("ExpiredAtDischarge"),
                rs.getBoolean("DischargedToHospice"),
                latest
        );
    };

    public List<AdmissionDto> findByPatient(long patientId) {
        String sql = SELECT + """
                WHERE a."PatientId" = :pid
                ORDER BY a."AdmissionId" DESC
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("pid", patientId),
                MAPPER
        );
    }

    public Optional<AdmissionRef> findRef(long admissionId) {
        String sql = """
                SELECT
                    a."AdmissionId",
                    a."PatientId",
                    p."ExternalPatientId",
                    a."ExpiredAtDischarge"
                FROM public."Admissions" a
                JOIN public."Patients" p
                    ON p."PatientId" = a."PatientId"
                WHERE a."AdmissionId" = :id
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("id", admissionId),
                (rs, i) -> new AdmissionRef(
                        rs.getLong("AdmissionId"),
                        rs.getLong("PatientId"),
                        rs.getString("ExternalPatientId"),
                        rs.getBoolean("ExpiredAtDischarge")
                )
        ).stream().findFirst();
    }

    /**
     * Admission features used by the ML prediction workflow.
     * LEFT JOIN preserves manually entered admissions without medication rows.
     */
    public Map<String, Object> findFeatures(long admissionId) {
        String sql = """
                SELECT
                    a."AdmissionId",
                    a."ExternalAdmissionId",
                    a."PatientId",
                    p."ExternalPatientId",
                    a."AgeGroup",
                    a."RaceAtAdmission",
                    a."GenderAtAdmission",
                    a."WeightRange",
                    a."PayerCode",
                    a."AdmissionTypeId",
                    a."AdmissionType",
                    a."DischargeDispositionId",
                    a."DischargeDisposition",
                    a."AdmissionSourceId",
                    a."AdmissionSource",
                    a."Department",
                    a."LengthOfStayDays",
                    a."NumLabTests",
                    a."NumProcedures",
                    a."NumMedications",
                    a."NumOutpatientVisits",
                    a."NumEmergencyVisits",
                    a."NumPriorAdmissions",
                    a."NumDiagnoses",
                    a."PrimaryDiagnosisCode",
                    a."SecondaryDiagnosisCode",
                    a."TertiaryDiagnosisCode",
                    a."MaxGluSerum",
                    a."A1CResult",
                    m."Metformin",
                    m."Repaglinide",
                    m."Nateglinide",
                    m."Chlorpropamide",
                    m."Glimepiride",
                    m."Acetohexamide",
                    m."Glipizide",
                    m."Glyburide",
                    m."Tolbutamide",
                    m."Pioglitazone",
                    m."Rosiglitazone",
                    m."Acarbose",
                    m."Miglitol",
                    m."Troglitazone",
                    m."Tolazamide",
                    m."Examide",
                    m."Citoglipton",
                    m."Insulin",
                    m."GlyburideMetformin",
                    m."GlipizideMetformin",
                    m."GlimepiridePioglitazone",
                    m."MetforminRosiglitazone",
                    m."MetforminPioglitazone",
                    m."MedicationChanged",
                    m."DiabetesMedPrescribed",
                    a."ExpiredAtDischarge",
                    a."DischargedToHospice"
                FROM public."Admissions" a
                JOIN public."Patients" p
                    ON p."PatientId" = a."PatientId"
                LEFT JOIN public."AdmissionMedications" m
                    ON m."AdmissionId" = a."AdmissionId"
                WHERE a."AdmissionId" = :id
                """;

        List<Map<String, Object>> rows = jdbc.queryForList(
                sql,
                new MapSqlParameterSource("id", admissionId)
        );

        return rows.isEmpty()
                ? Map.of()
                : new LinkedHashMap<>(rows.get(0));
    }
}
