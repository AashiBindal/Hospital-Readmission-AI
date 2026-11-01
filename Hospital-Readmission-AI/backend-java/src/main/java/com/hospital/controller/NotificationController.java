package com.hospital.controller;

import com.hospital.dto.Response.NotificationResponseDTO;
import com.hospital.Enum.NotificationCategory;
import com.hospital.service.ServiceImpl.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    // Assuming UserDetails implementation provides access to user UUID.
    // Adjust resolver depending on how your security context exposes user UUID.
    @GetMapping
    public ResponseEntity<Page<NotificationResponseDTO>> getNotifications(
            @RequestParam(required = false) NotificationCategory category,
            @RequestParam(required = false) Boolean unread,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {

        UUID userId = extractUserId(principal);
        Page<NotificationResponseDTO> notifications = notificationService.getNotifications(userId, category, unread, pageable);
        return ResponseEntity.ok(notifications);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable UUID id,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        UUID userId = extractUserId(principal);
        notificationService.markAsRead(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        UUID userId = extractUserId(principal);
        notificationService.markAllAsRead(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(
            @PathVariable UUID id,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        UUID userId = extractUserId(principal);
        notificationService.deleteNotification(id, userId);
        return ResponseEntity.noContent().build();
    }

    private UUID extractUserId(org.springframework.security.core.userdetails.User principal) {
        // Replace with your project's UserDetails principal custom property or username lookup method
        return UUID.fromString(principal.getUsername());
    }
}