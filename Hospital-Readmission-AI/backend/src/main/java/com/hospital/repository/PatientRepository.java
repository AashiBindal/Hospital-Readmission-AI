


package com.hospital.repository;




import com.hospital.dto.PatientRequests.CreatePatientRequest;

import com.hospital.dto.PatientRow;

import com.hospital.util.DiagnosisCategories;

import com.hospital.util.RiskLevels;

import com.hospital.util.SqlText;

import org.springframework.jdbc.core.RowMapper;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import org.springframework.stereotype.Repository;




import java.util.ArrayList;

import java.util.List;

import java.util.Optional;




@Repository

public class PatientRepository {




    public record Criteria(

            String search,

            String riskLevelDb,

            boolean unscoredOnly,

            String department

    ) {}




    private final NamedParameterJdbcTemplate jdbc;




    public PatientRepository(NamedParameterJdbcTemplate jdbc) {

        this.jdbc = jdbc;

    }




    private static String baseCte(String admissionFilter) {




        return """

                WITH la AS (

                    SELECT

                        a."AdmissionId",

                        a."PatientId",

                        a."AgeGroup",

                        a."Department",

                        a."PrimaryDiagnosisCode",

                        a."LengthOfStayDays",

                        a."NumPriorAdmissions",

                        a."NumEmergencyVisits",

                        a."NumMedications",

                        a."NumDiagnoses",

                        a."A1CResult",

                        a."ReadmissionStatus",

                        a."GenderAtAdmission",

                        a."RaceAtAdmission",

                        ROW_NUMBER() OVER (

                            PARTITION BY a."PatientId"

                            ORDER BY a."AdmissionId" DESC

                        ) AS rn,

                        COUNT(*) OVER (

                            PARTITION BY a."PatientId"

                        ) AS "AdmissionsCount"

                    FROM public."Admissions" a

                """ + admissionFilter + """

                ),

                lp AS (

                    SELECT

                        a."PatientId",

                        pr."PredictionId",

                        pr."RiskScore",

                        pr."RiskLevel",

                        pr."PredictedAt",

                        ROW_NUMBER() OVER (

                            PARTITION BY a."PatientId"

                            ORDER BY pr."PredictedAt" DESC, pr."PredictionId" DESC

                        ) AS rn

                    FROM public."Predictions" pr

                    JOIN public."Admissions" a

                        ON a."AdmissionId" = pr."AdmissionId"

                """ + admissionFilter + """

                )

                """;

    }




    private static final String SELECT_ROW = """

            SELECT

                p."PatientId" AS "PatientId",

                p."ExternalPatientId" AS "ExternalPatientId",

                COALESCE(p."Gender", la."GenderAtAdmission") AS "Gender",

                COALESCE(p."Race", la."RaceAtAdmission") AS "Race",

                p."HasDemographicConflict" AS "HasDemographicConflict",

                COALESCE(la."AdmissionsCount", 0) AS "AdmissionsCount",

                la."AdmissionId" AS "LatestAdmissionId",

                la."AgeGroup" AS "AgeGroup",

                la."Department" AS "Department",

                la."PrimaryDiagnosisCode" AS "PrimaryDiagnosisCode",

                la."LengthOfStayDays" AS "LengthOfStayDays",

                la."NumPriorAdmissions" AS "NumPriorAdmissions",

                la."NumEmergencyVisits" AS "NumEmergencyVisits",

                la."NumMedications" AS "NumMedications",

                la."NumDiagnoses" AS "NumDiagnoses",

                la."A1CResult" AS "A1CResult",

                la."ReadmissionStatus" AS "ReadmissionStatus",

                lp."RiskScore" AS "RiskScore",

                lp."RiskLevel" AS "RiskLevel",

                lp."PredictedAt" AS "PredictedAt"

            FROM public."Patients" p

            LEFT JOIN la

                ON la."PatientId" = p."PatientId"

                AND la.rn = 1

            LEFT JOIN lp

                ON lp."PatientId" = p."PatientId"

                AND lp.rn = 1

            """;




    static final RowMapper<PatientRow> ROW_MAPPER = (rs, i) -> {




        long id = rs.getLong("PatientId");

        String code = rs.getString("PrimaryDiagnosisCode");




        long latest = rs.getLong("LatestAdmissionId");

        Long latestAdmission = rs.wasNull() ? null : latest;




        return new PatientRow(

                String.valueOf(id),

                id,

                rs.getString("ExternalPatientId"),

                "Patient " + rs.getString("ExternalPatientId"),

                rs.getString("Gender"),

                rs.getString("Race"),

                rs.getBoolean("HasDemographicConflict"),

                rs.getInt("AdmissionsCount"),

                latestAdmission,

                rs.getString("AgeGroup"),

                rs.getString("Department"),

                code,

                code == null ? null : DiagnosisCategories.categorize(code),

                code == null ? null : DiagnosisCategories.describe(code),

                Jdbc.intOrNull(rs, "LengthOfStayDays"),

                Jdbc.intOrNull(rs, "NumPriorAdmissions"),

                Jdbc.intOrNull(rs, "NumEmergencyVisits"),

                Jdbc.intOrNull(rs, "NumMedications"),

                Jdbc.intOrNull(rs, "NumDiagnoses"),

                rs.getString("A1CResult"),

                rs.getString("ReadmissionStatus"),

                RiskLevels.percent(rs.getBigDecimal("RiskScore")),

                RiskLevels.label(rs.getString("RiskLevel")),

                Jdbc.local(rs.getTimestamp("PredictedAt"))

        );

    };




    private String where(Criteria c, MapSqlParameterSource params) {




        List<String> clauses = new ArrayList<>();




        if (c.search() != null && !c.search().isBlank()) {




            String s = c.search().trim();




            if (s.toLowerCase().startsWith("patient ")) {

                s = s.substring(8).trim();

            }




            params.addValue("prefix", SqlText.likeEscape(s) + "%");

            params.addValue("contains", "%" + SqlText.likeEscape(s) + "%");




            clauses.add("""

                    (

                        p."ExternalPatientId" ILIKE :prefix ESCAPE E'\\\\'

                        OR la."PrimaryDiagnosisCode" ILIKE :prefix ESCAPE E'\\\\'

                        OR la."Department" ILIKE :contains ESCAPE E'\\\\'

                    )

                    """);

        }




        if (c.unscoredOnly()) {

            clauses.add("lp.\"PredictionId\" IS NULL");




        } else if (c.riskLevelDb() != null) {




            params.addValue("risk", c.riskLevelDb());

            clauses.add("lp.\"RiskLevel\" = :risk");

        }




        if (c.department() != null) {

            params.addValue("dept", c.department());

            clauses.add("la.\"Department\" = :dept");

        }




        return clauses.isEmpty()

                ? ""

                : " WHERE " + String.join(" AND ", clauses);

    }




    public List<PatientRow> findPage(

            Criteria c,

            int page,

            int size

    ) {




        MapSqlParameterSource params = new MapSqlParameterSource()

                .addValue("offset", (long) page * size)

                .addValue("size", size);




        String sql = baseCte("")

                + SELECT_ROW

                + where(c, params)

                + """

                   ORDER BY

                       CASE WHEN lp."RiskScore" IS NULL THEN 1 ELSE 0 END,

                       lp."RiskScore" DESC,

                       p."PatientId"

                   LIMIT :size OFFSET :offset

                   """;




        return jdbc.query(sql, params, ROW_MAPPER);

    }




    public long count(Criteria c) {




        MapSqlParameterSource params = new MapSqlParameterSource();




        String sql = baseCte("")

                + """

                  SELECT COUNT(*)

                  FROM public."Patients" p

                  LEFT JOIN la

                      ON la."PatientId" = p."PatientId" AND la.rn = 1

                  LEFT JOIN lp

                      ON lp."PatientId" = p."PatientId" AND lp.rn = 1

                  """

                + where(c, params);




        Long n = jdbc.queryForObject(sql, params, Long.class);




        return n == null ? 0 : n;

    }




    public Optional<PatientRow> findRow(long patientId) {




        MapSqlParameterSource params =

                new MapSqlParameterSource("pid", patientId);




        String sql = baseCte(" WHERE a.\"PatientId\" = :pid ")

                + SELECT_ROW

                + " WHERE p.\"PatientId\" = :pid";




        return jdbc.query(sql, params, ROW_MAPPER)

                .stream()

                .findFirst();

    }




    public List<PatientRow> findTopByRisk(

            String riskLevelDb,

            int limit

    ) {




        MapSqlParameterSource params = new MapSqlParameterSource()

                .addValue("risk", riskLevelDb)

                .addValue("limit", limit);




        String sql = baseCte("")

                + "SELECT * FROM ("

                + SELECT_ROW

                + " WHERE lp.\"RiskLevel\" = :risk"

                + ") x "

                + """

                  ORDER BY x."RiskScore" DESC, x."PatientId"

                  LIMIT :limit

                  """;




        return jdbc.query(sql, params, ROW_MAPPER);

    }




    public boolean exists(long patientId) {




        Integer n = jdbc.queryForObject(

                """

                SELECT COUNT(*)

                FROM public."Patients"

                WHERE "PatientId" = :id

                """,

                new MapSqlParameterSource("id", patientId),

                Integer.class

        );




        return n != null && n > 0;

    }




    public boolean existsExternalId(String externalId) {




        Integer n = jdbc.queryForObject(

                """

                SELECT COUNT(*)

                FROM public."Patients"

                WHERE "ExternalPatientId" = :ext

                """,

                new MapSqlParameterSource("ext", externalId),

                Integer.class

        );




        return n != null && n > 0;

    }




    public long insertWithAdmission(CreatePatientRequest r) {




        String patientGender =

                "Unknown/Invalid".equals(r.gender()) ? null : r.gender();




        Long patientId = jdbc.queryForObject(

                """

                INSERT INTO public."Patients"

                (

                    "ExternalPatientId",

                    "Gender",

                    "Race",

                    "HasDemographicConflict"

                )

                VALUES (:ext, :gender, :race, FALSE)

                RETURNING "PatientId"

                """,

                new MapSqlParameterSource()

                        .addValue("ext", r.externalPatientId().trim())

                        .addValue("gender", patientGender)

                        .addValue("race", SqlText.blankToNull(r.race())),

                Long.class

        );




        if (patientId == null) {

            throw new IllegalStateException("No PatientId returned");

        }




        jdbc.update(

                """

                INSERT INTO public."Admissions"

                (

                    "PatientId",

                    "LengthOfStayDays",

                    "Department",

                    "PrimaryDiagnosisCode",

                    "SecondaryDiagnosisCode",

                    "NumDiagnoses",

                    "NumProcedures",

                    "NumMedications",

                    "NumLabTests",

                    "NumPriorAdmissions",

                    "NumOutpatientVisits",

                    "NumEmergencyVisits",

                    "AgeGroup",

                    "RaceAtAdmission",

                    "GenderAtAdmission",

                    "A1CResult",

                    "MaxGluSerum",

                    "ExpiredAtDischarge",

                    "DischargedToHospice"

                )

                VALUES

                (

                    :pid, :los, :dept, :d1, :d2, :ndx, :nproc,

                    :nmed, :nlab, :prior, :outp, :emerg, :age,

                    :race, :gender, :a1c, :glu, FALSE, FALSE

                )

                """,

                new MapSqlParameterSource()

                        .addValue("pid", patientId)

                        .addValue("los", r.lengthOfStay())

                        .addValue("dept", SqlText.blankToNull(r.department()))

                        .addValue("d1", r.primaryDiagnosisCode().trim())

                        .addValue("d2", SqlText.blankToNull(r.secondaryDiagnosisCode()))

                        .addValue("ndx", r.numDiagnoses())

                        .addValue("nproc", r.numProcedures())

                        .addValue("nmed", r.medicationsCount())

                        .addValue("nlab", r.numLabTests())

                        .addValue("prior", r.priorAdmissions())

                        .addValue("outp", r.outpatientVisits())

                        .addValue("emerg", r.emergencyVisits())

                        .addValue("age", r.ageGroup())

                        .addValue("race", SqlText.blankToNull(r.race()))

                        .addValue("gender", r.gender())

                        .addValue("a1c", SqlText.blankToNull(r.a1cResult()))

                        .addValue("glu", SqlText.blankToNull(r.maxGluSerum()))

        );




        return patientId;

    }




    public int updateDemographics(

            long patientId,

            String gender,

            String race

    ) {




        String patientGender =

                "Unknown/Invalid".equals(gender) ? null : gender;




        return jdbc.update(

                """

                UPDATE public."Patients"

                SET

                    "Gender" = :gender,

                    "Race" = :race,

                    "UpdatedAt" = CURRENT_TIMESTAMP

                WHERE "PatientId" = :id

                """,

                new MapSqlParameterSource()

                        .addValue("gender", patientGender)

                        .addValue("race", SqlText.blankToNull(race))

                        .addValue("id", patientId)

        );

    }

}