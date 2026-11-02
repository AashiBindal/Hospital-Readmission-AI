
package com.hospital.repository;

import com.hospital.dto.AnalyticsDtos.DepartmentOption;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public class AnalyticsRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public AnalyticsRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * One group of admissions: totals, readmissions and latest-prediction aggregates.
     */
    public record GroupStats(
            String key,
            long admissions,
            long eligible,
            long readmitted,
            long scored,
            Double avgRiskFraction
    ) {
    }

    private static String admissionsWithLatestPrediction(String department) {
        return """
                WITH ap AS (
                    SELECT
                        a.*,
                        lp."RiskScore" AS "LatestRiskScore",
                        lp."RiskLevel" AS "LatestRiskLevel",
                        CASE
                            WHEN a."ReadmissionStatus" IS NOT NULL
                                 AND a."ExpiredAtDischarge" IS FALSE
                            THEN 1
                            ELSE 0
                        END AS "Eligible"
                    FROM public."Admissions" a
                    LEFT JOIN LATERAL (
                        SELECT
                            x."RiskScore",
                            x."RiskLevel"
                        FROM public."Predictions" x
                        WHERE x."AdmissionId" = a."AdmissionId"
                        ORDER BY
                            x."PredictedAt" DESC,
                            x."PredictionId" DESC
                        LIMIT 1
                    ) lp ON TRUE
                """ +
                (department == null ? "" : """
                    WHERE a."Department" = :dept
                """) +
                """
                )
                """;
    }

    private static MapSqlParameterSource params(String department) {
        MapSqlParameterSource p = new MapSqlParameterSource();

        if (department != null) {
            p.addValue("dept", department);
        }

        return p;
    }

    private static final String GROUP_AGGREGATES = """
            COUNT(*) AS "Admissions",
            COALESCE(SUM("Eligible"), 0) AS "EligibleCount",
            COALESCE(
                SUM(
                    CASE
                        WHEN "Eligible" = 1
                             AND "Readmitted30Days" IS TRUE
                        THEN 1
                        ELSE 0
                    END
                ), 0
            ) AS "Readmitted",
            COUNT("LatestRiskScore") AS "Scored",
            AVG(CAST("LatestRiskScore" AS DOUBLE PRECISION)) AS "AvgRisk"
            """;

    private List<GroupStats> groupBy(
            String department,
            String keyExpression
    ) {
        String sql = admissionsWithLatestPrediction(department)
                + """
                SELECT
                    CAST(%s AS VARCHAR(100)) AS "GroupKey",
                    %s
                FROM ap
                GROUP BY %s
                """.formatted(keyExpression, GROUP_AGGREGATES, keyExpression);

        return jdbc.query(
                sql,
                params(department),
                (rs, i) -> new GroupStats(
                        rs.getString("GroupKey"),
                        rs.getLong("Admissions"),
                        rs.getLong("EligibleCount"),
                        rs.getLong("Readmitted"),
                        rs.getLong("Scored"),
                        Jdbc.doubleOrNull(rs, "AvgRisk")
                )
        );
    }

    public List<GroupStats> byLengthOfStay(String department) {
        return groupBy(department, "\"LengthOfStayDays\"");
    }

    public List<GroupStats> byAgeGroup(String department) {
        return groupBy(department, "\"AgeGroup\"");
    }

    public List<GroupStats> byPrimaryDiagnosisCode(String department) {
        return groupBy(department, "\"PrimaryDiagnosisCode\"");
    }

    /**
     * Totals over all admissions in scope.
     */
    public GroupStats totals(String department) {
        String sql = admissionsWithLatestPrediction(department)
                + """
                SELECT
                    'all' AS "GroupKey",
                    %s
                FROM ap
                """.formatted(GROUP_AGGREGATES);

        return jdbc.queryForObject(
                sql,
                params(department),
                (rs, i) -> new GroupStats(
                        "all",
                        rs.getLong("Admissions"),
                        rs.getLong("EligibleCount"),
                        rs.getLong("Readmitted"),
                        rs.getLong("Scored"),
                        Jdbc.doubleOrNull(rs, "AvgRisk")
                )
        );
    }

    /**
     * Patient-level risk tiers from each patient's latest prediction.
     */
    public Map<String, Object> patientRiskCounts(String department) {
        String sql = """
                WITH lp AS (
                    SELECT
                        a."PatientId",
                        pr."RiskScore",
                        pr."RiskLevel",
                        ROW_NUMBER() OVER (
                            PARTITION BY a."PatientId"
                            ORDER BY
                                pr."PredictedAt" DESC,
                                pr."PredictionId" DESC
                        ) AS rn
                    FROM public."Predictions" pr
                    JOIN public."Admissions" a
                        ON a."AdmissionId" = pr."AdmissionId"
                """ +
                (department == null ? "" : """
                    WHERE a."Department" = :dept
                """) +
                """
                ),
                pts AS (
                    SELECT DISTINCT a."PatientId"
                    FROM public."Admissions" a
                """ +
                (department == null ? "" : """
                    WHERE a."Department" = :dept
                """) +
                """
                )
                SELECT
                    t."TotalPatients",
                    s."LowCount",
                    s."MediumCount",
                    s."HighCount",
                    s."ScoredPatients",
                    s."AvgRisk"
                FROM (
                    SELECT COUNT(*) AS "TotalPatients"
                    FROM pts
                ) t
                CROSS JOIN (
                    SELECT
                        COUNT(*) FILTER (
                            WHERE lp."RiskLevel" = 'LOW'
                        ) AS "LowCount",
                        COUNT(*) FILTER (
                            WHERE lp."RiskLevel" = 'MEDIUM'
                        ) AS "MediumCount",
                        COUNT(*) FILTER (
                            WHERE lp."RiskLevel" = 'HIGH'
                        ) AS "HighCount",
                        COUNT(lp."PatientId") AS "ScoredPatients",
                        AVG(
                            CAST(lp."RiskScore" AS DOUBLE PRECISION)
                        ) AS "AvgRisk"
                    FROM lp
                    WHERE lp.rn = 1
                ) s
                """;

        return jdbc.queryForMap(sql, params(department));
    }

    /**
     * Counts for each candidate risk factor over eligible admissions.
     * factorConditions must contain trusted SQL expressions defined by the backend.
     */
    public Map<String, Object> riskFactorCounts(
            String department,
            Map<String, String> factorConditions
    ) {
        StringBuilder sb = new StringBuilder("""
                SELECT
                    COUNT(*) AS "total_n",
                    COALESCE(
                        SUM(
                            CASE WHEN a."Readmitted30Days" IS TRUE
                            THEN 1 ELSE 0 END
                        ), 0
                    ) AS "total_r"
                """);

        factorConditions.forEach((key, condition) -> {
            if (key == null || !key.matches("[A-Za-z][A-Za-z0-9_]*")) {
                throw new IllegalArgumentException(
                        "Invalid risk factor key: " + key
                );
            }

            if (condition == null || condition.isBlank()) {
                throw new IllegalArgumentException(
                        "Risk factor condition cannot be empty"
                );
            }

            sb.append(", SUM(CASE WHEN (")
                    .append(condition)
                    .append(") THEN 1 ELSE 0 END) AS \"")
                    .append(key)
                    .append("_n\"");

            sb.append(", SUM(CASE WHEN (")
                    .append(condition)
                    .append(") AND a.\"Readmitted30Days\" IS TRUE")
                    .append(" THEN 1 ELSE 0 END) AS \"")
                    .append(key)
                    .append("_r\"");
        });

        sb.append("""
                FROM public."Admissions" a
                LEFT JOIN public."AdmissionMedications" m
                    ON m."AdmissionId" = a."AdmissionId"
                WHERE a."ReadmissionStatus" IS NOT NULL
                  AND a."ExpiredAtDischarge" IS FALSE
                """);

        if (department != null) {
            sb.append("""
                    AND a."Department" = :dept
                    """);
        }

        return jdbc.queryForMap(
                sb.toString(),
                params(department)
        );
    }

    public List<DepartmentOption> departments() {
        String sql = """
                SELECT
                    "Department",
                    COUNT(*) AS "N"
                FROM public."Admissions"
                WHERE "Department" IS NOT NULL
                GROUP BY "Department"
                ORDER BY COUNT(*) DESC, "Department"
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource(),
                (rs, i) -> new DepartmentOption(
                        rs.getString("Department"),
                        rs.getLong("N")
                )
        );
    }

    public long countPatients() {
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM public."Patients"
                """,
                new MapSqlParameterSource(),
                Long.class
        );

        return n == null ? 0 : n;
    }
}
