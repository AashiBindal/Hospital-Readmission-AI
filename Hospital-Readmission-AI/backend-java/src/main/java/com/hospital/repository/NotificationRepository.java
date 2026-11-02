package com.hospital.repository;

import com.hospital.entity.Notification;
import com.hospital.Enum.NotificationCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserId(UUID userId, Pageable pageable);

    Page<Notification> findByUserIdAndCategory(UUID userId, NotificationCategory category, Pageable pageable);

    Page<Notification> findByUserIdAndUnread(UUID userId, Boolean unread, Pageable pageable);

    Page<Notification> findByUserIdAndCategoryAndUnread(UUID userId, NotificationCategory category, Boolean unread, Pageable pageable);

    long countByUserIdAndUnreadTrue(UUID userId);

    @Modifying
    @Query("UPDATE Notification n SET n.unread = false WHERE n.userId = :userId AND n.unread = true")
    void markAllAsReadForUser(@Param(value = "userId") UUID userId);

    boolean existsByUserIdAndCategoryAndTargetStateContaining(UUID userId, NotificationCategory category, String stateFragment);
}