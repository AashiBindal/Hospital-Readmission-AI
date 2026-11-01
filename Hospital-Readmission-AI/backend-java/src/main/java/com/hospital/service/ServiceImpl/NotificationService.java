package com.hospital.service.ServiceImpl;

import com.hospital.Enum.NotificationCategory;
import com.hospital.Enum.NotificationType;
import com.hospital.dto.Response.NotificationResponseDTO;
import com.hospital.entity.*;
import com.hospital.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional(readOnly = true)
    public Page<NotificationResponseDTO> getNotifications(UUID userId, NotificationCategory category, Boolean unread, Pageable pageable) {
        Page<Notification> page;
        if (category != null && unread != null) {
            page = notificationRepository.findByUserIdAndCategoryAndUnread(userId, category, unread, pageable);
        } else if (category != null) {
            page = notificationRepository.findByUserIdAndCategory(userId, category, pageable);
        } else if (unread != null) {
            page = notificationRepository.findByUserIdAndUnread(userId, unread, pageable);
        } else {
            page = notificationRepository.findByUserId(userId, pageable);
        }
        return page.map(this::mapToDTO);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndUnreadTrue(userId);
    }

    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        if (!notification.getUserId().equals(userId)) {
            throw new SecurityException("Unauthorized access to notification");
        }
        notification.setUnread(false);
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsReadForUser(userId);
    }

    @Transactional
    public void deleteNotification(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        if (!notification.getUserId().equals(userId)) {
            throw new SecurityException("Unauthorized access to notification");
        }
        notificationRepository.delete(notification);
    }

    @Transactional
    public void createNotification(UUID userId, NotificationCategory category, NotificationType type,
                                   String title, String description, String targetPath, String targetState) {
        Notification notification = Notification.builder()
                .displayId("NOTIF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .userId(userId)
                .category(category)
                .type(type)
                .title(title)
                .description(description)
                .targetPath(targetPath)
                .targetState(targetState)
                .build();
        notificationRepository.save(notification);
    }

    public boolean checkDuplicate(UUID userId, NotificationCategory category, String stateFragment) {
        return notificationRepository.existsByUserIdAndCategoryAndTargetStateContaining(userId, category, stateFragment);
    }

    private NotificationResponseDTO mapToDTO(Notification n) {
        return new NotificationResponseDTO(
                n.getId(),
                n.getDisplayId(),
                n.getCategory(),
                n.getType(),
                n.getTitle(),
                n.getDescription(),
                n.getCreatedAt(),
                n.getUnread(),
                n.getTargetPath(),
                n.getTargetState()
        );
    }
}