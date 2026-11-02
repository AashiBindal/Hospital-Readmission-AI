package com.hospital.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/**
 * Conversions between the database representation (RiskScore DECIMAL(5,4) 0-1,
 * RiskLevel LOW/MEDIUM/HIGH) and the API representation (whole percent, "Low"/"Medium"/"High").
 * The risk level itself is always the one assigned by the ML service; it is never recomputed here.
 */
public final class RiskLevels {

    private RiskLevels() {
    }

    public static String label(String dbLevel) {
        if (dbLevel == null) return null;
        return switch (dbLevel.trim().toUpperCase(Locale.ROOT)) {
            case "HIGH" -> "High";
            case "MEDIUM" -> "Medium";
            case "LOW" -> "Low";
            default -> null;
        };
    }

    /** "High" / "high" / "HIGH" -> "HIGH"; null for anything else. */
    public static String dbValue(String apiLevel) {
        if (apiLevel == null) return null;
        String v = apiLevel.trim().toUpperCase(Locale.ROOT);
        return switch (v) {
            case "HIGH", "MEDIUM", "LOW" -> v;
            default -> null;
        };
    }

    /** 0.7634 -> 76 (percent, half-up). */
    public static Integer percent(BigDecimal score) {
        if (score == null) return null;
        return score.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).intValue();
    }

    public static Double percent1(Double fraction) {
        if (fraction == null) return null;
        return Math.round(fraction * 1000.0) / 10.0;
    }
}
