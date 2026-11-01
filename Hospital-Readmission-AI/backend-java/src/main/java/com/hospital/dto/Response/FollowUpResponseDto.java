package com.hospital.dto.Response;

import com.hospital.entity.FollowUp;
import com.hospital.entity.RiskPrediction;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class FollowUpResponseDto {
    private UUID id;
    private String displayId;
    private UUID patientId;
    private String patientName;
    private UUID riskPredictionId;
    private RiskPrediction.RiskLevel riskLevel; // Fixed: Entity ke sath synchronized
    private BigDecimal riskScore;
    private FollowUp.Priority priority;
    private UUID assignedToId;
    private String assignedToName;
    private FollowUp.Channel channel;
    private LocalDate dueDate;
    private FollowUp.Status status;
    private String notes;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}