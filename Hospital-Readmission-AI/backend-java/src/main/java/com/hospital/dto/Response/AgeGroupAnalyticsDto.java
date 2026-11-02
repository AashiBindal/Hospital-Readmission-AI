package com.hospital.dto.Response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AgeGroupAnalyticsDto {
    private String ageGroup;
    private long totalPatients;
    private long lowRiskCount;
    private long mediumRiskCount;
    private long highRiskCount;
}