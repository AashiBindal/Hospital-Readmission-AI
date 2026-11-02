
package com.hospital.repository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public class NotificationRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public NotificationRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record NotificationRecord(
            long id,
            int userId,
            Long patientId,
            String type,
            String message,
            boolean read,
            LocalDateTime createdAt
    ) {
    }

    public List<NotificationRecord> findForUser(int userId, int limit) {

        String sql = """
                SELECT
                    "NotificationId",
                    "UserId",
                    "PatientId",
                    "Type",
                    "Message",
                    "IsRead",
                    "CreatedAt"
                FROM public."Notifications"
                WHERE "UserId" = :uid
                ORDER BY "CreatedAt" DESC, "NotificationId" DESC
                LIMIT :limit
                """;

        return jdbc.query(
                sql,
                new MapSqlParameterSource()
                        .addValue("uid", userId)
                        .addValue("limit", Math.max(1, limit)),
                (rs, i) -> new NotificationRecord(
                        rs.getLong("NotificationId"),
                        rs.getInt("UserId"),
                        Jdbc.longOrNull(rs, "PatientId"),
                        rs.getString("Type"),
                        rs.getString("Message"),
                        rs.getBoolean("IsRead"),
                        Jdbc.local(rs.getTimestamp("CreatedAt"))
                )
        );
    }

    public void insert(int userId, Long patientId, String type, String message) {

        String text = message == null
                ? ""
                : message.length() > 500
                  ? message.substring(0, 497) + "..."
                  : message;

        String sql = """
                INSERT INTO public."Notifications"
                    ("UserId", "PatientId", "Type", "Message")
                VALUES
                    (:uid, :pid, :type, :msg)
                """;

        jdbc.update(
                sql,
                new MapSqlParameterSource()
                        .addValue("uid", userId)
                        .addValue("pid", patientId)
                        .addValue("type", type)
                        .addValue("msg", text)
        );
    }

    public boolean exists(int userId, String type, String message) {

        String sql = """
                SELECT COUNT(*)
                FROM public."Notifications"
                WHERE "UserId" = :uid
                  AND "Type" = :type
                  AND "Message" = :msg
                """;

        Integer count = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource()
                        .addValue("uid", userId)
                        .addValue("type", type)
                        .addValue("msg", message),
                Integer.class
        );

        return count != null && count > 0;
    }

    /**
     * Only the owner's notification is changed.
     * Returns 0 if not found or not owned by the user.
     */
    public int setRead(long id, int userId, boolean read) {

        String sql = """
                UPDATE public."Notifications"
                SET "IsRead" = :read
                WHERE "NotificationId" = :id
                  AND "UserId" = :uid
                """;

        return jdbc.update(
                sql,
                new MapSqlParameterSource()
                        .addValue("read", read)
                        .addValue("id", id)
                        .addValue("uid", userId)
        );
    }

    public int markAllRead(int userId) {

        String sql = """
                UPDATE public."Notifications"
                SET "IsRead" = TRUE
                WHERE "UserId" = :uid
                  AND "IsRead" = FALSE
                """;

        return jdbc.update(
                sql,
                new MapSqlParameterSource("uid", userId)
        );
    }

    public int delete(long id, int userId) {

        String sql = """
                DELETE FROM public."Notifications"
                WHERE "NotificationId" = :id
                  AND "UserId" = :uid
                """;

        return jdbc.update(
                sql,
                new MapSqlParameterSource()
                        .addValue("id", id)
                        .addValue("uid", userId)
        );
    }
}
