
package com.hospital.repository;

import com.hospital.dto.UploadDtos.QualityIssue;
import com.hospital.dto.UploadDtos.UploadRow;
import com.hospital.security.Role;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class UploadRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public UploadRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String SELECT = """
            SELECT
                up."UploadId",
                up."FileName",
                up."FileSizeBytes",
                up."Status",
                up."TotalRows",
                up."ValidRows",
                up."RejectedRows",
                up."ErrorMessage",
                up."UploadedAt",
                up."ProcessedAt",
                COALESCE(u."FullName", u."Username") AS "UploaderName",
                u."Role",
                (
                    SELECT COUNT(DISTINCT a."AdmissionId")
                    FROM public."Admissions" a
                    JOIN LATERAL (
                        SELECT x."RiskLevel"
                        FROM public."Predictions" x
                        WHERE x."AdmissionId" = a."AdmissionId"
                        ORDER BY
                            x."PredictedAt" DESC,
                            x."PredictionId" DESC
                        LIMIT 1
                    ) lp ON TRUE
                    WHERE a."UploadId" = up."UploadId"
                      AND lp."RiskLevel" = 'HIGH'
                ) AS "HighRiskFound"
            FROM public."Uploads" up
            LEFT JOIN public."Users" u
                ON u."UserId" = up."UploadedBy"
            """;

    private static final RowMapper<UploadRow> MAPPER = (rs, i) -> {
        Role role = Role.parse(rs.getString("Role"));

        return new UploadRow(
                String.valueOf(rs.getLong("UploadId")),
                rs.getString("FileName"),
                Jdbc.longOrNull(rs, "FileSizeBytes"),
                rs.getString("UploaderName"),
                role == null ? null : role.label(),
                Jdbc.local(rs.getTimestamp("UploadedAt")),
                FollowUpRepository.titleCase(rs.getString("Status")),
                Jdbc.intOrNull(rs, "TotalRows"),
                Jdbc.intOrNull(rs, "ValidRows"),
                Jdbc.intOrNull(rs, "RejectedRows"),
                rs.getLong("HighRiskFound"),
                rs.getString("ErrorMessage"),
                Jdbc.local(rs.getTimestamp("ProcessedAt"))
        );
    };

    public List<UploadRow> findRecent(int limit) {
        String sql = SELECT + """
                ORDER BY up."UploadedAt" DESC, up."UploadId" DESC
                LIMIT :limit
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("limit", limit),
                MAPPER
        );
    }

    public Optional<UploadRow> findById(long id) {
        String sql = SELECT + """
                WHERE up."UploadId" = :id
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("id", id),
                MAPPER
        ).stream().findFirst();
    }

    public long insertPending(
            String fileName,
            long sizeBytes,
            int uploadedBy
    ) {
        String sql = """
                INSERT INTO public."Uploads"
                    ("FileName", "FileSizeBytes", "UploadedBy", "Status")
                VALUES
                    (:name, :size, :uid, 'PENDING')
                RETURNING "UploadId"
                """;

        Long id = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource()
                        .addValue("name", fileName)
                        .addValue("size", sizeBytes)
                        .addValue("uid", uploadedBy),
                Long.class
        );

        if (id == null) {
            throw new IllegalStateException("No UploadId returned");
        }

        return id;
    }

    public String status(long id) {
        String sql = """
                SELECT "Status"
                FROM public."Uploads"
                WHERE "UploadId" = :id
                """;

        List<String> statuses = jdbc.queryForList(
                sql,
                new MapSqlParameterSource("id", id),
                String.class
        );

        return statuses.isEmpty() ? null : statuses.get(0);
    }

    public Optional<Integer> uploader(long id) {
        String sql = """
                SELECT "UploadedBy"
                FROM public."Uploads"
                WHERE "UploadId" = :id
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("id", id),
                (rs, i) -> Jdbc.intOrNull(rs, "UploadedBy")
        ).stream().findFirst();
    }

    /**
     * Marks an upload FAILED only if ETL has not already completed.
     */
    public void markFailedIfUnfinished(long id, String message) {
        String text = message == null
                ? null
                : message.length() > 4000
                  ? message.substring(0, 4000)
                  : message;

        String sql = """
                UPDATE public."Uploads"
                SET
                    "Status" = 'FAILED',
                    "ErrorMessage" = :msg,
                    "ProcessedAt" = CURRENT_TIMESTAMP
                WHERE "UploadId" = :id
                  AND "Status" IN ('PENDING', 'PROCESSING')
                """;

        jdbc.update(
                sql,
                new MapSqlParameterSource()
                        .addValue("msg", text)
                        .addValue("id", id)
        );
    }

    public void setMessage(long id, String message) {
        String sql = """
                UPDATE public."Uploads"
                SET "ErrorMessage" = :msg
                WHERE "UploadId" = :id
                  AND "Status" = 'PENDING'
                """;

        jdbc.update(
                sql,
                new MapSqlParameterSource()
                        .addValue("msg", message)
                        .addValue("id", id)
        );
    }

    public List<QualityIssue> findIssues(long uploadId) {
        String sql = """
                SELECT
                    "RuleName",
                    "ColumnName",
                    "Severity",
                    "AffectedRows",
                    "Details"
                FROM public."DataQualityLogs"
                WHERE "UploadId" = :id
                ORDER BY
                    CASE "Severity"
                        WHEN 'ERROR' THEN 0
                        WHEN 'WARNING' THEN 1
                        ELSE 2
                    END,
                    "AffectedRows" DESC,
                    "LogId"
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource("id", uploadId),
                (rs, i) -> new QualityIssue(
                        rs.getString("RuleName"),
                        rs.getString("ColumnName"),
                        rs.getString("Severity"),
                        rs.getInt("AffectedRows"),
                        rs.getString("Details")
                )
        );
    }
}
