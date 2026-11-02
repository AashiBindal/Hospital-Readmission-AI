


package com.hospital.config;




import com.hospital.repository.UserRepository;

import com.hospital.security.Role;

import org.slf4j.Logger;

import org.slf4j.LoggerFactory;

import org.springframework.boot.ApplicationArguments;

import org.springframework.boot.ApplicationRunner;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.stereotype.Component;




import java.util.ArrayList;

import java.util.List;

import java.util.Locale;




@Component

public class StartupChecks implements ApplicationRunner {




    private static final Logger log =

            LoggerFactory.getLogger(StartupChecks.class);




    private static final String[][] REQUIRED = {

            {"Users", "UserId"}, {"Users", "Email"},

            {"Users", "PasswordHash"}, {"Users", "Role"},

            {"Users", "Department"}, {"Users", "Phone"},

            {"Users", "LicenseId"}, {"Users", "LastLoginAt"},

            {"Patients", "ExternalPatientId"},

            {"Patients", "HasDemographicConflict"},

            {"Admissions", "AgeGroup"},

            {"Admissions", "ReadmissionStatus"},

            {"Admissions", "ExpiredAtDischarge"},

            {"Admissions", "NumEmergencyVisits"},

            {"Admissions", "A1CResult"},

            {"AdmissionMedications", "Insulin"},

            {"AdmissionMedications", "MedicationChanged"},

            {"AdmissionTypes", "Description"},

            {"AdmissionSources", "Description"},

            {"DischargeDispositions", "Description"},

            {"Predictions", "RiskScore"},

            {"Followups", "Priority"},

            {"Notifications", "Message"},

            {"Uploads", "Status"},

            {"DataQualityLogs", "RuleName"}

    };




    private final NamedParameterJdbcTemplate jdbc;

    private final UserRepository users;

    private final PasswordEncoder encoder;

    private final AppProperties props;




    public StartupChecks(

            NamedParameterJdbcTemplate jdbc,

            UserRepository users,

            PasswordEncoder encoder,

            AppProperties props) {

        this.jdbc = jdbc;

        this.users = users;

        this.encoder = encoder;

        this.props = props;

    }




    @Override

    public void run(ApplicationArguments args) {




        String db = jdbc.queryForObject(

                "SELECT current_database()",

                new MapSqlParameterSource(),

                String.class

        );




        List<String> missing = new ArrayList<>();




        for (String[] tc : REQUIRED) {




            Boolean exists = jdbc.queryForObject(

                    """

                    SELECT EXISTS (

                        SELECT 1

                        FROM information_schema.columns

                        WHERE table_schema = 'public'

                          AND table_name = :t

                          AND column_name = :c

                    )

                    """,

                    new MapSqlParameterSource()

                            .addValue("t", tc[0])

                            .addValue("c", tc[1]),

                    Boolean.class

            );




            if (!Boolean.TRUE.equals(exists)) {

                missing.add(tc[0] + "." + tc[1]);

            }

        }




        if (!missing.isEmpty()) {

            throw new IllegalStateException(

                    "Database " + db + " is missing " + missing

                            + ". Run database/schema.sql and required PostgreSQL migrations."

            );

        }




        log.info(

                "Connected to PostgreSQL database {}; schema check passed ({} columns).",

                db, REQUIRED.length

        );




        bootstrapAdmin();

    }




    private void bootstrapAdmin() {




        AppProperties.Bootstrap b = props.bootstrap();




        if (b.adminEmail() == null || b.adminEmail().isBlank()) return;




        if (users.existsAdmin()) {

            log.info("ADMIN account already exists; nothing to bootstrap.");

            return;

        }




        if (b.adminPassword() == null || b.adminPassword().length() < 12) {

            throw new IllegalStateException(

                    "ADMIN_PASSWORD must be at least 12 characters."

            );

        }




        String email = b.adminEmail().trim().toLowerCase(Locale.ROOT);




        if (users.existsByEmailOrUsername(email)) {

            throw new IllegalStateException(

                    "ADMIN_EMAIL " + email + " already belongs to a non-admin account."

            );

        }




        String name = b.adminName() == null || b.adminName().isBlank()

                ? "System Administrator"

                : b.adminName().trim();




        users.insert(

                email,

                encoder.encode(b.adminPassword()),

                name,

                Role.ADMIN,

                null,

                null,

                null

        );




        log.warn(

                "Created the first ADMIN account {}. Remove ADMIN_PASSWORD from the environment now.",

                email

        );

    }

}