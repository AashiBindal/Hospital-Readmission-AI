package com.hospital.service;

import com.hospital.dto.AnalyticsDtos.AgeGroupPoint;
import com.hospital.dto.AnalyticsDtos.CohortSummary;
import com.hospital.dto.AnalyticsDtos.DepartmentOption;
import com.hospital.dto.AnalyticsDtos.DiagnosisPoint;
import com.hospital.dto.AnalyticsDtos.LengthOfStayPoint;
import com.hospital.dto.AnalyticsDtos.RiskFactor;
import com.hospital.repository.AnalyticsRepository;
import com.hospital.repository.AnalyticsRepository.GroupStats;
import com.hospital.util.DiagnosisCategories;
import com.hospital.util.SqlText;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Analytics computed from the loaded dataset at request time. Nothing here is a model output
 * except the "predicted" averages, which come from predictions stored by the ML service.
 */
@Service
public class AnalyticsService {

    private final AnalyticsRepository repo;

    public AnalyticsService(AnalyticsRepository repo) {
        this.repo = repo;
    }

    public static String normalizeDepartment(String department) {
        String d = SqlText.blankToNull(department);
        if (d == null || "All".equalsIgnoreCase(d) || "All Departments".equalsIgnoreCase(d)) return null;
        return d;
    }

    public CohortSummary summary(String department) {
        String dept = normalizeDepartment(department);
        GroupStats totals = repo.totals(dept);
        Map<String, Object> risk = repo.patientRiskCounts(dept);
        long totalPatients = num(risk.get("TotalPatients"));
        long scored = num(risk.get("ScoredPatients"));
        Double avg = risk.get("AvgRisk") instanceof Number n ? SqlText.round1(n.doubleValue() * 100) : null;
        return new CohortSummary(totalPatients, totals.admissions(), totals.eligible(),
                SqlText.rate(totals.readmitted(), totals.eligible()), scored, Math.max(0, totalPatients - scored),
                num(risk.get("LowCount")), num(risk.get("MediumCount")), num(risk.get("HighCount")), avg);
    }

    public List<LengthOfStayPoint> lengthOfStay(String department) {
        List<LengthOfStayPoint> points = new ArrayList<>();
        for (GroupStats g : repo.byLengthOfStay(normalizeDepartment(department))) {
            if (g.key() == null) continue;
            int days = Integer.parseInt(g.key());
            points.add(new LengthOfStayPoint(days + "d", days, "Length of stay " + days + (days == 1 ? " day" : " days"),
                    g.eligible(), g.readmitted(), SqlText.rate(g.readmitted(), g.eligible()), avgPercent(g), g.scored()));
        }
        points.sort(Comparator.comparingInt(LengthOfStayPoint::lengthOfStay));
        return points;
    }

    public List<AgeGroupPoint> ageGroups(String department) {
        List<AgeGroupPoint> points = new ArrayList<>();
        for (GroupStats g : repo.byAgeGroup(normalizeDepartment(department))) {
            if (g.key() == null) continue;
            points.add(new AgeGroupPoint(g.key(), ageLabel(g.key()), g.eligible(), g.readmitted(),
                    SqlText.rate(g.readmitted(), g.eligible()), avgPercent(g), g.scored()));
        }
        points.sort(Comparator.comparingInt(p -> ageStart(p.ageGroup())));
        return points;
    }

    public List<DiagnosisPoint> byDiagnosis(String department) {
        Map<String, long[]> acc = new LinkedHashMap<>(); // eligible, readmitted, scored
        Map<String, Double> riskSum = new LinkedHashMap<>();
        for (GroupStats g : repo.byPrimaryDiagnosisCode(normalizeDepartment(department))) {
            String cat = DiagnosisCategories.categorize(g.key());
            long[] a = acc.computeIfAbsent(cat, k -> new long[3]);
            a[0] += g.eligible();
            a[1] += g.readmitted();
            a[2] += g.scored();
            if (g.avgRiskFraction() != null && g.scored() > 0) {
                riskSum.merge(cat, g.avgRiskFraction() * g.scored(), Double::sum);
            }
        }
        List<DiagnosisPoint> points = new ArrayList<>();
        acc.forEach((cat, a) -> {
            Double avg = a[2] > 0 && riskSum.containsKey(cat) ? SqlText.round1(100.0 * riskSum.get(cat) / a[2]) : null;
            points.add(new DiagnosisPoint(cat, a[0], a[1], SqlText.rate(a[1], a[0]), avg, a[2]));
        });
        points.removeIf(p -> p.count() == 0);
        points.sort(Comparator.comparingLong(DiagnosisPoint::count).reversed());
        return points;
    }

    /** Candidate factors: SQL condition over dbo.Admissions a / dbo.AdmissionMedications m, and a label. */
    private static final Map<String, String[]> FACTORS = new LinkedHashMap<>();

    static {
        FACTORS.put("prior_inpatient", new String[]{"a.NumPriorAdmissions >= 1", "Prior inpatient admission in the preceding year"});
        FACTORS.put("emergency", new String[]{"a.NumEmergencyVisits >= 1", "Emergency visit in the preceding year"});
        FACTORS.put("outpatient", new String[]{"a.NumOutpatientVisits >= 1", "Outpatient visit in the preceding year"});
        FACTORS.put("many_diagnoses", new String[]{"a.NumDiagnoses >= 9", "9 or more coded diagnoses"});
        FACTORS.put("long_stay", new String[]{"a.LengthOfStayDays >= 7", "Length of stay of 7 days or more"});
        FACTORS.put("polypharmacy", new String[]{"a.NumMedications >= 20", "20 or more medications during the stay"});
        FACTORS.put("a1c_over_8", new String[]{"a.A1CResult = N'>8'", "HbA1c result above 8%"});
        FACTORS.put("insulin", new String[]{"m.Insulin IN (N'Steady', N'Up', N'Down')", "On insulin"});
        FACTORS.put("med_changed", new String[]{"m.MedicationChanged = 1", "Diabetes medication changed"});
        FACTORS.put("age_70_plus", new String[]{"a.AgeGroup IN (N'[70-80)', N'[80-90)', N'[90-100)')", "Age 70 or older"});
        FACTORS.put("not_home", new String[]{"a.DischargeDispositionId IS NOT NULL AND a.DischargeDispositionId NOT IN (1, 18, 25, 26)",
                "Discharged somewhere other than home"});
    }

    /**
     * Observed relative risk of 30-day readmission for admissions with vs. without each factor
     * (eligible admissions only). relativeImpact scales the strongest factor to 100.
     */
    public List<RiskFactor> riskFactors(String department) {
        Map<String, String> conditions = new LinkedHashMap<>();
        FACTORS.forEach((k, v) -> conditions.put(k, v[0]));
        Map<String, Object> counts = repo.riskFactorCounts(normalizeDepartment(department), conditions);
        long total = num(counts.get("total_n"));
        long totalReadmitted = num(counts.get("total_r"));
        List<RiskFactor> list = new ArrayList<>();
        double maxExcess = 0;
        for (Map.Entry<String, String[]> e : FACTORS.entrySet()) {
            long n = num(counts.get(e.getKey() + "_n"));
            long r = num(counts.get(e.getKey() + "_r"));
            long nWithout = total - n;
            long rWithout = totalReadmitted - r;
            Double with = SqlText.rate(r, n);
            Double without = SqlText.rate(rWithout, nWithout);
            Double rr = (n > 0 && nWithout > 0 && rWithout > 0)
                    ? Math.round(((double) r / n) / ((double) rWithout / nWithout) * 100.0) / 100.0 : null;
            if (rr != null) maxExcess = Math.max(maxExcess, rr - 1);
            String note = (with == null || without == null) ? "Not enough admissions to compare."
                    : "30-day readmission " + with + "% with this factor vs " + without + "% without (" + n
                    + " of " + total + " admissions affected).";
            list.add(new RiskFactor(e.getKey(), e.getValue()[1], n, total, SqlText.rate(n, total), with, without, rr,
                    rr == null ? null : rr + "× readmission rate", null, note));
        }
        final double scale = maxExcess;
        List<RiskFactor> result = new ArrayList<>();
        for (RiskFactor f : list) {
            Integer impact = (f.relativeRisk() == null || scale <= 0) ? null
                    : (int) Math.round(Math.max(0, f.relativeRisk() - 1) / scale * 100);
            result.add(new RiskFactor(f.key(), f.name(), f.affectedCount(), f.totalCohort(), f.prevalencePct(),
                    f.readmissionRateWith(), f.readmissionRateWithout(), f.relativeRisk(), f.multiplier(), impact,
                    f.clinicalNote()));
        }
        result.sort(Comparator.comparing((RiskFactor f) -> f.relativeRisk() == null ? -1 : f.relativeRisk()).reversed());
        return result;
    }

    public List<DepartmentOption> departments() {
        return repo.departments();
    }

    private static Double avgPercent(GroupStats g) {
        return g.avgRiskFraction() == null ? null : SqlText.round1(g.avgRiskFraction() * 100);
    }

    static String ageLabel(String band) {
        // "[70-80)" -> "70-79"
        try {
            String inner = band.substring(1, band.length() - 1);
            String[] parts = inner.split("-");
            return parts[0] + "-" + (Integer.parseInt(parts[1]) - 1);
        } catch (RuntimeException ex) {
            return band;
        }
    }

    static int ageStart(String band) {
        try {
            return Integer.parseInt(band.substring(1, band.indexOf('-')));
        } catch (RuntimeException ex) {
            return Integer.MAX_VALUE;
        }
    }

    private static long num(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }
}
