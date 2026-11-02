package com.hospital.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class RecentActivityDto {
    private String activityType; // e.g., PATIENT_REGISTERED, DATA_UPLOADED, RISK_PREDICTED, FOLLOW_UP_CREATED
    private String title;
    private String description;
    private LocalDateTime timestamp;
    private String referenceId;
}