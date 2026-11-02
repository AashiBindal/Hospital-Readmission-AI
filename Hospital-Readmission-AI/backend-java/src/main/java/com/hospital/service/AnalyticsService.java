package com.hospital.service;

import com.hospital.dto.Response.AnalyticsResponseDto;
import com.hospital.entity.Patient;

import java.time.LocalDate;
import java.util.UUID;

public interface AnalyticsService {
    AnalyticsResponseDto getAnalyticsOverview(
            LocalDate startDate,
            LocalDate endDate,
            UUID departmentId,
            String diagnosis,
            Patient.RiskLevel riskLevel,
            UUID assignedUserId
    );
}