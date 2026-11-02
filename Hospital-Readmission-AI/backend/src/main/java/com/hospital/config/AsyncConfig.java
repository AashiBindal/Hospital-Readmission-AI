package com.hospital.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Single worker for ETL runs: dataset loads are executed one at a time so two
 * uploads never write to the database concurrently.
 */
@Configuration
public class AsyncConfig {

    @Bean(destroyMethod = "shutdown")
    public ExecutorService etlExecutor() {
        return Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "etl-runner");
            t.setDaemon(true);
            return t;
        });
    }
}
