package com.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;

public final class FollowUpDtos {

    private FollowUpDtos() {
    }

    public static final String PRIORITY = "^(Urgent|High|Medium|Low|Routine)$";

    public record CreateFollowUpRequest(
            @NotBlank(message = "Select a registered patient.") @Pattern(regexp = "^[0-9]+$", message = "patientId must be the numeric patient id.") String patientId,
            Long predictionId,
            Integer assignedToUserId,
            @NotBlank(message = "Outreach channel is required.") @Size(max = 50, message = "Channel must be at most 50 characters.") String channel,
            @NotNull(message = "Due date is required.") LocalDate dueDate,
            @NotBlank(message = "Priority is required.") @Pattern(regexp = PRIORITY, message = "Priority must be Urgent, High, Medium, Low or Routine.") String priority,
            @Size(max = 4000, message = "Notes must be at most 4000 characters.") String notes) {
    }

    public record UpdateStatusRequest(
            @NotBlank(message = "Status is required.")
            @Pattern(regexp = "^(Done|Completed|Scheduled|Missed|Cancelled)$", message = "Status must be Done, Completed, Scheduled, Missed or Cancelled.")
            String status) {
    }

    /** status: Scheduled | Completed | Missed | Cancelled (database values in title case). */
    public record FollowUpDto(String id, String patientId, String externalPatientId, String patientName,
                              String riskLevel, Integer riskScore, Long predictionId, Integer assignedToUserId,
                              String assignedTo, String channel, LocalDate dueDate, String priority, String status,
                              LocalDateTime completedDate, String notes, LocalDateTime createdAt) {
    }
}
