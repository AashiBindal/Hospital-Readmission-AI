package com.hospital.dto.Request;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DiagnosisAnalyticsDto {
    private String diagnosis;
    private long patientCount;
    private long highRiskCount;
    private double highRiskPercentage;
}