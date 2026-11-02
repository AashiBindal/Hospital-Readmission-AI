package com.hospital.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        // Java 8 Date/Time (LocalDate, LocalDateTime) ko correctly JSON mein serialize/deserialize karne ke liye
        mapper.registerModule(new JavaTimeModule());
        return mapper;
    }
}