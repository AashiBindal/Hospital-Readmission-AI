
package com.hospital.repository;

import com.hospital.dto.FollowUpDtos.FollowUpDto;
import com.hospital.util.RiskLevels;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Repository
public class FollowUpRepository {

    /**
     * UI groups:
     * Pending = SCHEDULED and not past due;
     * Overdue = SCHEDULED past due or MISSED;
     * Done = COMPLETED or CANCELLED.
     */
    public enum Group {
        PENDING, OVERDUE, DONE
    }

    private final NamedParameterJdbcTemplate jdbc;

    public FollowUpRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String SELECT = """
            SELECT
                f."FollowupId",
                f."PatientId",
                p."ExternalPatientId",
                f."PredictionId",
                f."AssignedTo",
                COALESCE(u."FullName", u."Username") AS "AssignedName",
                f."FollowupType",
                f."ScheduledDate",
                f."Priority",
                f."Status",
                f."CompletedDate",
                f."Notes",
                f."CreatedAt",
                r."RiskScore",
                r."RiskLevel"
            FROM public."Followups" f
            JOIN public."Patients" p
                ON p."PatientId" = f."PatientId"
            LEFT JOIN public."Users" u
                ON u."UserId" = f."AssignedTo"
            LEFT JOIN LATERAL (
                SELECT
                    x."RiskScore",
                    x."RiskLevel"
                FROM public."Predictions" x
                JOIN public."Admissions" a
                    ON a."AdmissionId" = x."AdmissionId"
                WHERE
                    (
                        f."PredictionId" IS NOT NULL
                        AND x."PredictionId" = f."PredictionId"
                    )
                    OR
                    (
                        f."PredictionId" IS NULL
                        AND a."PatientId" = f."PatientId"
                    )
                ORDER BY
                    x."PredictedAt" DESC,
                    x."PredictionId" DESC
                LIMIT 1
            ) r ON TRUE
            """;

    private static final RowMapper<FollowUpDto> MAPPER = (rs, i) -> {
        Date scheduled = rs.getDate("ScheduledDate");
        String ext = rs.getString("ExternalPatientId");

        return new FollowUpDto(
                String.valueOf(rs.getLong("FollowupId")),
                String.valueOf(rs.getLong("PatientId")),
                ext,
                "Patient " + ext,
                RiskLevels.label(rs.getString("RiskLevel")),
                RiskLevels.percent(rs.getBigDecimal("RiskScore")),
                Jdbc.longOrNull(rs, "PredictionId"),
                Jdbc.intOrNull(rs, "AssignedTo"),
                rs.getString("AssignedName"),
                rs.getString("FollowupType"),
                scheduled == null ? null : scheduled.toLocalDate(),
                rs.getString("Priority"),
                titleCase(rs.getString("Status")),
                Jdbc.local(rs.getTimestamp("CompletedDate")),
                rs.getString("Notes"),
                Jdbc.local(rs.getTimestamp("CreatedAt"))
        );
    };

    public List<FollowUpDto> find(
            Group group,
            String priority,
            LocalDate today
    ) {
        MapSqlParameterSource params =
                new MapSqlParameterSource("today", today);

        List<String> where = new ArrayList<>();

        if (group != null) {
            where.add(groupClause(group));
        }

        if (priority != null) {
            where.add("f.\"Priority\" = :priority");
            params.addValue("priority", priority);
        }

        String sql = SELECT
                + (where.isEmpty()
                ? ""
                : " WHERE " + String.join(" AND ", where))
                + """
                ORDER BY
                    CASE
                        WHEN f."Status" = 'SCHEDULED' THEN 0
                        ELSE 1
                    END,
                    f."ScheduledDate",
                    f."FollowupId"
                """;

        return jdbc.query(sql, params, MAPPER);
    }

    public long count(Group group, LocalDate today) {
        if (group == null) {
            throw new IllegalArgumentException(
                    "Follow-up group cannot be null"
            );
        }

        String sql = """
                SELECT COUNT(*)
                FROM public."Followups" f
                WHERE
                """ + groupClause(group);

        Long n = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource("today", today),
                Long.class
        );

        return n == null ? 0 : n;
    }

    private static String groupClause(Group group) {
        return switch (group) {
            case PENDING ->
                    """
                    (
                        f."Status" = 'SCHEDULED'
                        AND f."ScheduledDate" >= :today
                    )
                    """;

            case OVERDUE ->
                    """
                    (
                        (
                            f."Status" = 'SCHEDULED'
                            AND f."ScheduledDate" < :today
                        )
                        OR f."Status" = 'MISSED'
                    )
                    """;

            case DONE ->
                    """
                    f."Status" IN ('COMPLETED', 'CANCELLED')
                    """;
        };
    }

    public Optional<FollowUpDto> findById(long id) {
        return jdbc.query(
                SELECT + """
                        WHERE f."FollowupId" = :id
                        """,
                new MapSqlParameterSource("id", id),
                MAPPER
        ).stream().findFirst();
    }

    public long insert(
            long patientId,
            Long predictionId,
            Integer assignedTo,
            String channel,
            LocalDate dueDate,
            String priority,
            String notes
    ) {
        String sql = """
                INSERT INTO public."Followups"
                    (
                        "PatientId",
                        "PredictionId",
                        "AssignedTo",
                        "FollowupType",
                        "ScheduledDate",
                        "Status",
                        "Notes",
                        "Priority"
                    )
                VALUES
                    (
                        :pid,
                        :pred,
                        :assigned,
                        :channel,
                        :due,
                        'SCHEDULED',
                        :notes,
                        :priority
                    )
                RETURNING "FollowupId"
                """;

        Long id = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource()
                        .addValue("pid", patientId)
                        .addValue("pred", predictionId)
                        .addValue("assigned", assignedTo)
                        .addValue("channel", channel)
                        .addValue("due", dueDate)
                        .addValue("notes", notes)
                        .addValue("priority", priority),
                Long.class
        );

        if (id == null) {
            throw new IllegalStateException(
                    "No FollowupId returned"
            );
        }

        return id;
    }

    /**
     * CompletedDate is set only for COMPLETED status.
     */
    public int updateStatus(long id, String statusDb) {
        String sql = """
                UPDATE public."Followups"
                SET
                    "Status" = :status,
                    "CompletedDate" = CASE
                        WHEN :status = 'COMPLETED'
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END
                WHERE "FollowupId" = :id
                """;

        return jdbc.update(
                sql,
                new MapSqlParameterSource()
                        .addValue("status", statusDb)
                        .addValue("id", id)
        );
    }

    /**
     * Overdue scheduled follow-ups with an assignee.
     */
    public List<FollowUpDto> findOverdueAssigned(LocalDate today) {
        String sql = SELECT + """
                WHERE f."Status" = 'SCHEDULED'
                  AND f."ScheduledDate" < :today
                  AND f."AssignedTo" IS NOT NULL
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("today", today),
                MAPPER
        );
    }

    /**
     * High-risk patients whose latest prediction is HIGH
     * and who have no SCHEDULED follow-up.
     */
    public long countHighRiskWithoutScheduled() {
        String sql = """
                WITH lp AS (
                    SELECT
                        a."PatientId",
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
                )
                SELECT COUNT(*)
                FROM lp
                WHERE lp.rn = 1
                  AND lp."RiskLevel" = 'HIGH'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public."Followups" f
                      WHERE f."PatientId" = lp."PatientId"
                        AND f."Status" = 'SCHEDULED'
                  )
                """;

        Long n = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource(),
                Long.class
        );

        return n == null ? 0 : n;
    }

    static String titleCase(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }

        String lower = s.toLowerCase(Locale.ROOT);

        return Character.toUpperCase(lower.charAt(0))
                + lower.substring(1);
    }
}
