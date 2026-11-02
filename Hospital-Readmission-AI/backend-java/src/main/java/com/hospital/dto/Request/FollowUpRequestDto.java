package com.hospital.dto.Request;

import com.hospital.entity.FollowUp;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class FollowUpRequestDto {
    @NotNull(message = "Patient ID is required")
    private UUID patientId;

    private UUID riskPredictionId;

    @NotNull(message = "Priority is required")
    private FollowUp.Priority priority;

    @NotNull(message = "Assigned user ID is required")
    private UUID assignedToId;

    @NotNull(message = "Channel is required")
    private FollowUp.Channel channel;

    @NotNull(message = "Due date is required")
    private LocalDate dueDate;

    private String notes;
}