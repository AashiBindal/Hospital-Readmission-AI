package com.hospital.dto.Response;

import com.hospital.Enum.NotificationCategory;
import com.hospital.Enum.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponseDTO {

    private UUID id;
    private String displayId;
    private NotificationCategory category;
    private NotificationType type;
    private String title;
    private String description;
    private OffsetDateTime createdAt;
    private Boolean unread;
    private String targetPath;
    private String targetState; // JSON string or raw JSON content for frontend navigation context
}