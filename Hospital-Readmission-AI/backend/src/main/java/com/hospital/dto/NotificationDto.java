package com.hospital.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * category: high_risk | overdue | upload | info  (used by the UI filters)
 * type:     high | low | info                     (used by the UI colours)
 */
public record NotificationDto(String id, String category, String type, String title, String description,
                              String time, LocalDateTime createdAt, boolean unread, String targetPath,
                              Map<String, Object> targetState, String patientId) {
}
