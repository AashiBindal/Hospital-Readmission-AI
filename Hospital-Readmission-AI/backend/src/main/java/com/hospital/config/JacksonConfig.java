package com.hospital.config;

import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Every DATETIME2 column in the schema is written with SYSUTCDATETIME(), so timestamps are UTC
 * wall-clock values. They are serialised with a trailing "Z" so browsers convert them to local time.
 */
@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter UTC_ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer utcLocalDateTime() {
        return builder -> builder.serializerByType(LocalDateTime.class, new LocalDateTimeSerializer(UTC_ISO));
    }
}
