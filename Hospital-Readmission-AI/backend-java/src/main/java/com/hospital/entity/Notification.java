package com.hospital.entity;

import com.hospital.Enum.NotificationCategory;
import com.hospital.Enum.NotificationType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications", indexes = {
        @Index(name = "idx_notifications_user_unread", columnList = "user_id, unread"),
        @Index(name = "idx_notifications_user_created", columnList = "user_id, created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "display_id", unique = true, nullable = false, length = 50)
    private String displayId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 50)
    private NotificationCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private NotificationType type;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "unread", nullable = false)
    private Boolean unread = true;

    @Column(name = "target_path", nullable = false)
    private String targetPath;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "target_state", columnDefinition = "jsonb")
    private String targetState;
}