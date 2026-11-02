
package com.hospital.repository;

import com.hospital.dto.UserDto;
import com.hospital.security.AuthenticatedUser;
import com.hospital.security.Role;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class UserRepository {

    private static final String COLUMNS =
            "\"UserId\", \"Username\", \"Email\", \"PasswordHash\", " +
                    "\"FullName\", \"Role\", \"IsActive\", \"CreatedAt\", " +
                    "\"Department\", \"Phone\", \"LicenseId\", \"LastLoginAt\"";

    private final NamedParameterJdbcTemplate jdbc;

    public UserRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Internal row including the password hash; never serialized.
     */
    public record UserRecord(
            int id,
            String username,
            String email,
            String passwordHash,
            String fullName,
            Role role,
            boolean active,
            LocalDateTime createdAt,
            String department,
            String phone,
            String licenseId,
            LocalDateTime lastLoginAt
    ) {

        public UserDto toDto() {
            return new UserDto(
                    id,
                    fullName != null ? fullName : username,
                    email,
                    role.label(),
                    department,
                    phone,
                    licenseId,
                    active,
                    initials(fullName != null ? fullName : username),
                    lastLoginAt,
                    createdAt
            );
        }

        public AuthenticatedUser toPrincipal() {
            return new AuthenticatedUser(id, email, role);
        }
    }

    private static final RowMapper<UserRecord> MAPPER = (rs, i) ->
            new UserRecord(
                    rs.getInt("UserId"),
                    rs.getString("Username"),
                    rs.getString("Email"),
                    rs.getString("PasswordHash"),
                    rs.getString("FullName"),
                    Role.parse(rs.getString("Role")),
                    rs.getBoolean("IsActive"),
                    toLocal(rs.getTimestamp("CreatedAt")),
                    rs.getString("Department"),
                    rs.getString("Phone"),
                    rs.getString("LicenseId"),
                    toLocal(rs.getTimestamp("LastLoginAt"))
            );

    public Optional<UserRecord> findByEmail(String email) {

        String sql = "SELECT " + COLUMNS +
                " FROM public.\"Users\" WHERE \"Email\" = :email";

        return jdbc.query(
                sql,
                new MapSqlParameterSource("email", email),
                MAPPER
        ).stream().findFirst();
    }

    public Optional<UserRecord> findById(int id) {

        String sql = "SELECT " + COLUMNS +
                " FROM public.\"Users\" WHERE \"UserId\" = :id";

        return jdbc.query(
                sql,
                new MapSqlParameterSource("id", id),
                MAPPER
        ).stream().findFirst();
    }

    public Optional<AuthenticatedUser> findActiveAuthUser(int id) {
        return findById(id)
                .filter(UserRecord::active)
                .filter(u -> u.role() != null)
                .map(UserRecord::toPrincipal);
    }

    public boolean existsByEmailOrUsername(String email) {

        String sql = """
                SELECT COUNT(*)
                FROM public."Users"
                WHERE "Email" = :email
                   OR "Username" = :email
                """;

        Integer count = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource("email", email),
                Integer.class
        );

        return count != null && count > 0;
    }

    public boolean existsAdmin() {

        String sql = """
                SELECT COUNT(*)
                FROM public."Users"
                WHERE "Role" = :role
                """;

        Integer count = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource("role", "ADMIN"),
                Integer.class
        );

        return count != null && count > 0;
    }

    public int insert(
            String email,
            String passwordHash,
            String fullName,
            Role role,
            String department,
            String phone,
            String licenseId
    ) {

        String sql = """
                INSERT INTO public."Users"
                (
                    "Username",
                    "Email",
                    "PasswordHash",
                    "FullName",
                    "Role",
                    "IsActive",
                    "Department",
                    "Phone",
                    "LicenseId"
                )
                VALUES
                (
                    :email,
                    :email,
                    :hash,
                    :name,
                    :role,
                    TRUE,
                    :department,
                    :phone,
                    :license
                )
                RETURNING "UserId"
                """;

        Integer id = jdbc.queryForObject(
                sql,
                new MapSqlParameterSource()
                        .addValue("email", email)
                        .addValue("hash", passwordHash)
                        .addValue("name", fullName)
                        .addValue("role", role.name())
                        .addValue("department", department)
                        .addValue("phone", phone)
                        .addValue("license", licenseId),
                Integer.class
        );

        if (id == null) {
            throw new IllegalStateException("No UserId returned");
        }

        return id;
    }

    public void touchLastLogin(int id) {

        String sql = """
                UPDATE public."Users"
                SET "LastLoginAt" = CURRENT_TIMESTAMP
                WHERE "UserId" = :id
                """;

        jdbc.update(
                sql,
                new MapSqlParameterSource("id", id)
        );
    }

    public List<UserRecord> findAll(boolean activeOnly) {

        String sql = "SELECT " + COLUMNS +
                " FROM public.\"Users\"" +
                (activeOnly ? " WHERE \"IsActive\" = TRUE" : "") +
                " ORDER BY \"FullName\", \"Email\"";

        return jdbc.query(
                sql,
                new MapSqlParameterSource(),
                MAPPER
        );
    }

    /**
     * Active clinical users (Admin, Doctor, Nurse).
     * Recipients of high-risk alerts.
     */
    public List<Integer> findActiveClinicalUserIds() {

        String sql = """
                SELECT "UserId"
                FROM public."Users"
                WHERE "IsActive" = TRUE
                  AND "Role" IN ('ADMIN', 'DOCTOR', 'NURSE')
                """;

        return jdbc.queryForList(
                sql,
                new MapSqlParameterSource(),
                Integer.class
        );
    }

    static LocalDateTime toLocal(Timestamp ts) {
        return ts == null ? null : ts.toLocalDateTime();
    }

    static String initials(String name) {

        if (name == null || name.isBlank()) {
            return "?";
        }

        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();

        for (String p : parts) {
            if (!p.isEmpty() && Character.isLetter(p.charAt(0))) {
                sb.append(Character.toUpperCase(p.charAt(0)));
            }

            if (sb.length() == 2) {
                break;
            }
        }

        return sb.length() == 0 ? "?" : sb.toString();
    }
}
