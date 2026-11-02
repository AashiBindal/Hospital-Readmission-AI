package com.hospital.service;

import com.hospital.dto.NotificationDto;
import com.hospital.exception.ApiException;
import com.hospital.repository.FollowUpRepository;
import com.hospital.repository.NotificationRepository;
import com.hospital.repository.NotificationRepository.NotificationRecord;
import com.hospital.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Persists and serves dbo.Notifications. Notification types written by the backend:
 * HIGH_RISK, FOLLOWUP_ASSIGNED, FOLLOWUP_OVERDUE, UPLOAD_COMPLETED, UPLOAD_FAILED.
 */
@Service
public class NotificationService {

    public static final String HIGH_RISK = "HIGH_RISK";
    public static final String FOLLOWUP_ASSIGNED = "FOLLOWUP_ASSIGNED";
    public static final String FOLLOWUP_OVERDUE = "FOLLOWUP_OVERDUE";
    public static final String UPLOAD_COMPLETED = "UPLOAD_COMPLETED";
    public static final String UPLOAD_FAILED = "UPLOAD_FAILED";

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notifications;
    private final UserRepository users;
    private final FollowUpRepository followUps;

    public NotificationService(NotificationRepository notifications, UserRepository users, FollowUpRepository followUps) {
        this.notifications = notifications;
        this.users = users;
        this.followUps = followUps;
    }

    public List<NotificationDto> forUser(int userId) {
        LocalDateTime nowUtc = LocalDateTime.now(ZoneOffset.UTC);
        return notifications.findForUser(userId, 200).stream().map(n -> toDto(n, nowUtc)).toList();
    }

    public void setRead(long id, int userId, boolean read) {
        if (notifications.setRead(id, userId, read) == 0) throw ApiException.notFound("Notification");
    }

    public int markAllRead(int userId) {
        return notifications.markAllRead(userId);
    }

    public void delete(long id, int userId) {
        if (notifications.delete(id, userId) == 0) throw ApiException.notFound("Notification");
    }

    public void notifyUser(int userId, Long patientId, String type, String message) {
        notifications.insert(userId, patientId, type, message);
    }

    public void notifyClinicalStaff(Long patientId, String type, String message) {
        for (Integer uid : users.findActiveClinicalUserIds()) {
            notifications.insert(uid, patientId, type, message);
        }
    }

    /**
     * Hourly: one FOLLOWUP_OVERDUE alert per overdue follow-up for its assignee
     * (de-duplicated on the message text, which contains the follow-up id).
     */
    @Scheduled(initialDelay = 60_000, fixedDelay = 3_600_000)
    @Transactional
    public void createOverdueAlerts() {
        try {
            int created = 0;
            for (var f : followUps.findOverdueAssigned(LocalDate.now())) {
                String msg = "Follow-up #" + f.id() + " for " + f.patientName() + " (" + f.channel()
                        + ") was due " + f.dueDate() + " and is still open.";
                if (!notifications.exists(f.assignedToUserId(), FOLLOWUP_OVERDUE, msg)) {
                    notifications.insert(f.assignedToUserId(), Long.valueOf(f.patientId()), FOLLOWUP_OVERDUE, msg);
                    created++;
                }
            }
            if (created > 0) log.info("Created {} overdue follow-up notifications", created);
        } catch (RuntimeException ex) {
            log.warn("Overdue follow-up check failed: {}", ex.getMessage());
        }
    }

    private static NotificationDto toDto(NotificationRecord n, LocalDateTime nowUtc) {
        String category;
        String uiType;
        String title;
        String target;
        Map<String, Object> state = null;
        switch (n.type() == null ? "" : n.type()) {
            case HIGH_RISK -> {
                category = "high_risk"; uiType = "high"; title = "High-risk readmission prediction"; target = "/patients";
            }
            case FOLLOWUP_OVERDUE -> {
                category = "overdue"; uiType = "high"; title = "Overdue follow-up"; target = "/follow-ups";
                state = new LinkedHashMap<>(Map.of("statusFilter", "Overdue"));
            }
            case FOLLOWUP_ASSIGNED -> {
                category = "info"; uiType = "info"; title = "Follow-up assigned to you"; target = "/follow-ups";
            }
            case UPLOAD_COMPLETED -> {
                category = "upload"; uiType = "low"; title = "Dataset upload completed"; target = "/data-upload";
            }
            case UPLOAD_FAILED -> {
                category = "upload"; uiType = "high"; title = "Dataset upload failed"; target = "/data-upload";
            }
            default -> {
                category = "info"; uiType = "info"; title = n.type() == null ? "Notification" : n.type(); target = null;
            }
        }
        if (n.patientId() != null && "/patients".equals(target)) {
            state = new LinkedHashMap<>(Map.of("selectedPatientId", String.valueOf(n.patientId())));
        }
        return new NotificationDto(String.valueOf(n.id()), category, uiType, title, n.message(),
                relative(n.createdAt(), nowUtc), n.createdAt(), !n.read(), target, state,
                n.patientId() == null ? null : String.valueOf(n.patientId()));
    }

    /** CreatedAt is stored with SYSUTCDATETIME(), so it is compared with the current UTC time. */
    static String relative(LocalDateTime createdUtc, LocalDateTime nowUtc) {
        if (createdUtc == null) return "";
        long minutes = Math.max(0, Duration.between(createdUtc, nowUtc).toMinutes());
        if (minutes < 1) return "Just now";
        if (minutes < 60) return minutes + " min ago";
        long hours = minutes / 60;
        if (hours < 24) return hours + (hours == 1 ? " hour ago" : " hours ago");
        long days = hours / 24;
        return days + (days == 1 ? " day ago" : " days ago");
    }
}
