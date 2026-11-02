package com.hospital.controller;

import com.hospital.dto.AnalyticsDtos.AgeGroupPoint;
import com.hospital.dto.AnalyticsDtos.CohortSummary;
import com.hospital.dto.AnalyticsDtos.DiagnosisPoint;
import com.hospital.dto.AnalyticsDtos.LengthOfStayPoint;
import com.hospital.dto.AnalyticsDtos.RiskFactor;
import com.hospital.service.AnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** All endpoints accept an optional department (exact Admissions.Department value; "All Departments" = no filter). */
@RestController
@RequestMapping("/analytics")
public class AnalyticsController {

    private final AnalyticsService analytics;

    public AnalyticsController(AnalyticsService analytics) {
        this.analytics = analytics;
    }

    @GetMapping("/summary")
    public CohortSummary summary(@RequestParam(required = false) String department) {
        return analytics.summary(department);
    }

    @GetMapping("/length-of-stay")
    public List<LengthOfStayPoint> lengthOfStay(@RequestParam(required = false) String department) {
        return analytics.lengthOfStay(department);
    }

    @GetMapping("/age-groups")
    public List<AgeGroupPoint> ageGroups(@RequestParam(required = false) String department) {
        return analytics.ageGroups(department);
    }

    @GetMapping("/risk-factors")
    public List<RiskFactor> riskFactors(@RequestParam(required = false) String department) {
        return analytics.riskFactors(department);
    }

    @GetMapping("/by-diagnosis")
    public List<DiagnosisPoint> byDiagnosis(@RequestParam(required = false) String department) {
        return analytics.byDiagnosis(department);
    }
}
