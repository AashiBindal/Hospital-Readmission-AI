package com.hospital.dto.Request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FollowUpCompletionDto {
    @NotBlank(message = "Contact method is required")
    private String contactMethod;

    @NotBlank(message = "Outcome is required")
    private String outcome;

    private String staffCompletionNotes;
}