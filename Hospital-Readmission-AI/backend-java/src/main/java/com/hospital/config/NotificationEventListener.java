package com.hospital.config;

import com.hospital.Enum.NotificationCategory;
import com.hospital.Enum.NotificationType;
import com.hospital.service.ServiceImpl.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final NotificationService notificationService;

    public record HighRiskPatientEvent(UUID doctorId, String patientName, double riskScore, UUID patientId) {}
    public record OverdueFollowUpEvent(UUID assignedUserId, String patientName, UUID followUpId) {}
    public record DataUploadEvent(UUID userId, String filename, boolean success) {}
    public record ScheduledFollowUpEvent(UUID assignedUserId, String patientName, String scheduledDate, UUID followUpId) {}

    @Async
    @EventListener
    public void handleHighRisk(HighRiskPatientEvent event) {
        try {
            String title = "High Risk Alert: " + event.patientName();
            String desc = String.format("Patient %s has been evaluated with a critical readmission risk score of %.2f%%.", event.patientName(), event.riskScore() * 100);
            String path = "/patients/" + event.patientId();
            notificationService.createNotification(event.doctorId(), NotificationCategory.HIGH_RISK, NotificationType.HIGH, title, desc, path, "{\"patientId\":\"" + event.patientId() + "\"}");
        } catch (Exception e) {
            log.error("Failed to generate high-risk notification", e);
        }
    }

    @Async
    @EventListener
    public void handleOverdue(OverdueFollowUpEvent event) {
        try {
            String stateKey = "\"followUpId\":\"" + event.followUpId() + "\"";
            if (notificationService.checkDuplicate(event.assignedUserId(), NotificationCategory.OVERDUE, stateKey)) {
                return; // Prevent duplicates
            }
            String title = "Overdue Follow-up: " + event.patientName();
            String desc = "The scheduled follow-up for patient " + event.patientName() + " is overdue and requires immediate attention.";
            String path = "/follow-ups/" + event.followUpId();
            notificationService.createNotification(event.assignedUserId(), NotificationCategory.OVERDUE, NotificationType.HIGH, title, desc, path, "{" + stateKey + "}");
        } catch (Exception e) {
            log.error("Failed to generate overdue notification", e);
        }
    }

    @Async
    @EventListener
    public void handleUpload(DataUploadEvent event) {
        try {
            String title = event.success() ? "Data Upload Successful" : "Data Upload Failed";
            String desc = event.success()
                    ? "File '" + event.filename() + "' was successfully processed and validated."
                    : "Validation failed for uploaded file '" + event.filename() + "'. Please check format requirements.";
            NotificationType type = event.success() ? NotificationType.INFO : NotificationType.LOW;
            String path = "/data-uploads";
            notificationService.createNotification(event.userId(), NotificationCategory.UPLOAD, type, title, desc, path, "{\"filename\":\"" + event.filename() + "\"}");
        } catch (Exception e) {
            log.error("Failed to generate upload notification", e);
        }
    }

    @Async
    @EventListener
    public void handleScheduled(ScheduledFollowUpEvent event) {
        try {
            String stateKey = "\"followUpId\":\"" + event.followUpId() + "\"";
            if (notificationService.checkDuplicate(event.assignedUserId(), NotificationCategory.SCHEDULED, stateKey)) {
                return; // Prevent duplicates on mere status updates
            }
            String title = "Follow-up Scheduled";
            String desc = "A new follow-up appointment has been scheduled for patient " + event.patientName() + " on " + event.scheduledDate() + ".";
            String path = "/follow-ups/" + event.followUpId();
            notificationService.createNotification(event.assignedUserId(), NotificationCategory.SCHEDULED, NotificationType.INFO, title, desc, path, "{" + stateKey + "}");
        } catch (Exception e) {
            log.error("Failed to generate scheduled follow-up notification", e);
        }
    }
}