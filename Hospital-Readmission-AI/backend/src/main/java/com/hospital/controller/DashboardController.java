package com.hospital.controller;

import com.hospital.dto.DashboardSummary;
import com.hospital.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {

    private final DashboardService dashboard;

    public DashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    /** The dataset has no admission dates, so there is no date-range parameter. */
    @GetMapping("/summary")
    public DashboardSummary summary() {
        return dashboard.summary();
    }
}
