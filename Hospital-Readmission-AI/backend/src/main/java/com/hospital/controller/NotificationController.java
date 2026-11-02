package com.hospital.controller;

import com.hospital.dto.NotificationDto;
import com.hospital.security.CurrentUser;
import com.hospital.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Notifications of the signed-in user only. */
@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public List<NotificationDto> list() {
        return notifications.forUser(CurrentUser.get().id());
    }

    @PatchMapping("/{id}/read")
    public Map<String, Object> markRead(@PathVariable long id) {
        notifications.setRead(id, CurrentUser.get().id(), true);
        return Map.of("id", String.valueOf(id), "unread", false);
    }

    @PatchMapping("/{id}/unread")
    public Map<String, Object> markUnread(@PathVariable long id) {
        notifications.setRead(id, CurrentUser.get().id(), false);
        return Map.of("id", String.valueOf(id), "unread", true);
    }

    @PatchMapping("/read-all")
    public Map<String, Object> markAllRead() {
        return Map.of("updated", notifications.markAllRead(CurrentUser.get().id()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        notifications.delete(id, CurrentUser.get().id());
        return ResponseEntity.noContent().build();
    }
}
