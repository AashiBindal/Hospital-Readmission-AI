package com.hospital.util;

/** Helpers for building safe parameterised SQL. Values are always bound as parameters. */
public final class SqlText {

    private SqlText() {
    }

    /** Escapes LIKE wildcards so user input is matched literally (used with ESCAPE '\'). */
    public static String likeEscape(String input) {
        return input.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").replace("[", "\\[");
    }

    public static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** One decimal place, e.g. 11.16 -> 11.2. */
    public static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    public static Double rate(long part, long whole) {
        if (whole <= 0) return null;
        return round1(100.0 * part / whole);
    }
}
