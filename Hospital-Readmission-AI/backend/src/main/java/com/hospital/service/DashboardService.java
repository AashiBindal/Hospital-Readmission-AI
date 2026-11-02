package com.hospital.service;

import com.hospital.dto.AnalyticsDtos.CohortSummary;
import com.hospital.dto.DashboardSummary;
import com.hospital.dto.DashboardSummary.Intervention;
import com.hospital.repository.FollowUpRepository;
import com.hospital.repository.FollowUpRepository.Group;
import com.hospital.repository.PatientRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class DashboardService {

    private final AnalyticsService analytics;
    private final FollowUpRepository followUps;
    private final PatientRepository patients;

    public DashboardService(AnalyticsService analytics, FollowUpRepository followUps, PatientRepository patients) {
        this.analytics = analytics;
        this.followUps = followUps;
        this.patients = patients;
    }

    public DashboardSummary summary() {
        CohortSummary c = analytics.summary(null);
        LocalDate today = LocalDate.now();
        long pending = followUps.count(Group.PENDING, today);
        long overdue = followUps.count(Group.OVERDUE, today);
        long highWithout = followUps.countHighRiskWithoutScheduled();

        // Work items derived from current counts; an item is listed only when its count is above zero.
        List<Intervention> items = new ArrayList<>();
        if (highWithout > 0) {
            items.add(new Intervention("high-risk-no-followup", highWithout + " high-risk patient" + plural(highWithout)
                    + " without a scheduled follow-up",
                    "Latest prediction is High and no follow-up is scheduled. Review them and schedule outreach.",
                    "High", "/patients"));
        }
        if (overdue > 0) {
            items.add(new Intervention("overdue-followups", overdue + " overdue follow-up" + plural(overdue),
                    "Scheduled follow-ups past their due date (or marked missed).", "High", "/follow-ups"));
        }
        if (c.unscoredPatients() > 0) {
            items.add(new Intervention("unscored-patients", c.unscoredPatients() + " patient" + plural(c.unscoredPatients())
                    + " not scored yet", "No stored ML prediction. Open the Risk Predictor to score their latest admission.",
                    "Medium", "/risk-prediction"));
        }
        return new DashboardSummary(c.totalPatients(), c.totalAdmissions(), c.scoredPatients(), c.unscoredPatients(),
                c.lowRiskCount(), c.mediumRiskCount(), c.highRiskCount(), c.avgPredictedRisk(), c.observedReadmissionRate(),
                pending, overdue, highWithout, items, patients.findTopByRisk("HIGH", 5));
    }

    private static String plural(long n) {
        return n == 1 ? "" : "s";
    }
}
