package com.hospital.controller;

import com.hospital.dto.Response.AnalyticsResponseDto;
import com.hospital.entity.Patient;
import com.hospital.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<AnalyticsResponseDto> getAnalyticsOverview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) String diagnosis,
            @RequestParam(required = false) Patient.RiskLevel riskLevel,
            @RequestParam(required = false) UUID assignedUserId) {

        AnalyticsResponseDto overview = analyticsService.getAnalyticsOverview(
                startDate, endDate, departmentId, diagnosis, riskLevel, assignedUserId
        );
        return ResponseEntity.ok(overview);
    }
}