package com.hospital.dto.Response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter @AllArgsConstructor
public class JwtResponse {
    private String accessToken;
    private String tokenType = "Bearer";
    private Long id;
    private String username;
    private String email;
    private List<String> roles;
}