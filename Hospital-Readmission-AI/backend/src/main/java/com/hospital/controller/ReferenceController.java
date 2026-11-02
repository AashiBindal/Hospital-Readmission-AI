package com.hospital.controller;

import com.hospital.dto.AnalyticsDtos.DepartmentOption;
import com.hospital.service.AnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Option lists built from the data (used by the frontend filters). */
@RestController
@RequestMapping("/reference")
public class ReferenceController {

    private final AnalyticsService analytics;

    public ReferenceController(AnalyticsService analytics) {
        this.analytics = analytics;
    }

    /** Distinct Admissions.Department values (medical specialty) with admission counts, most frequent first. */
    @GetMapping("/departments")
    public List<DepartmentOption> departments() {
        return analytics.departments();
    }
}
