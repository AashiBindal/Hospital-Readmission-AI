package com.hospital.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class AnalyticsHelpersTest {

    @Test
    void ageBandLabelsAndOrdering() {
        assertEquals("70-79", AnalyticsService.ageLabel("[70-80)"));
        assertEquals("0-9", AnalyticsService.ageLabel("[0-10)"));
        assertEquals(90, AnalyticsService.ageStart("[90-100)"));
    }

    @Test
    void departmentFilterNormalisation() {
        assertNull(AnalyticsService.normalizeDepartment("All Departments"));
        assertNull(AnalyticsService.normalizeDepartment(" "));
        assertEquals("Cardiology", AnalyticsService.normalizeDepartment("Cardiology"));
    }

    @Test
    void relativeTimes() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 2, 12, 0);
        assertEquals("Just now", NotificationService.relative(now.minusSeconds(20), now));
        assertEquals("5 min ago", NotificationService.relative(now.minusMinutes(5), now));
        assertEquals("1 hour ago", NotificationService.relative(now.minusMinutes(61), now));
        assertEquals("3 days ago", NotificationService.relative(now.minusDays(3), now));
    }

    @Test
    void recommendedActionPerTier() {
        assertEquals(true, PredictionService.recommendedAction("HIGH").startsWith("High risk"));
        assertEquals(true, PredictionService.recommendedAction("LOW").startsWith("Low risk"));
    }
}
