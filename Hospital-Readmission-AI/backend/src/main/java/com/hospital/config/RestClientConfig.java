package com.hospital.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * RestClient pre-configured with the ML service base URL (app.ml-service.url).
 */
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient mlServiceRestClient(AppProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.mlService().timeoutMs());
        factory.setReadTimeout(props.mlService().timeoutMs());
        return RestClient.builder()
                .baseUrl(props.mlService().url())
                .requestFactory(factory)
                .build();
    }
}
