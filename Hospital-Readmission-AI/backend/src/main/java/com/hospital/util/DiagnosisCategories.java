package com.hospital.util;

/**
 * Groups ICD-9-CM codes (as stored in Admissions.PrimaryDiagnosisCode, e.g. "428", "250.83",
 * "008", "V57") into the nine categories used by Strack et al. (2014) for this dataset.
 */
public final class DiagnosisCategories {

    public static final String CIRCULATORY = "Circulatory";
    public static final String RESPIRATORY = "Respiratory";
    public static final String DIGESTIVE = "Digestive";
    public static final String DIABETES = "Diabetes";
    public static final String INJURY = "Injury";
    public static final String MUSCULOSKELETAL = "Musculoskeletal";
    public static final String GENITOURINARY = "Genitourinary";
    public static final String NEOPLASMS = "Neoplasms";
    public static final String OTHER = "Other";
    public static final String UNKNOWN = "Not recorded";

    private DiagnosisCategories() {
    }

    public static String categorize(String code) {
        if (code == null || code.isBlank()) return UNKNOWN;
        String c = code.trim().toUpperCase();
        if (c.startsWith("V") || c.startsWith("E")) return OTHER;
        double value;
        try {
            value = Double.parseDouble(c);
        } catch (NumberFormatException ex) {
            return OTHER;
        }
        int whole = (int) Math.floor(value);
        if (whole == 250) return DIABETES;
        if ((whole >= 390 && whole <= 459) || whole == 785) return CIRCULATORY;
        if ((whole >= 460 && whole <= 519) || whole == 786) return RESPIRATORY;
        if ((whole >= 520 && whole <= 579) || whole == 787) return DIGESTIVE;
        if (whole >= 800 && whole <= 999) return INJURY;
        if (whole >= 710 && whole <= 739) return MUSCULOSKELETAL;
        if ((whole >= 580 && whole <= 629) || whole == 788) return GENITOURINARY;
        if (whole >= 140 && whole <= 239) return NEOPLASMS;
        return OTHER;
    }

    /** "428 · Circulatory" (or "Not recorded"). */
    public static String describe(String code) {
        if (code == null || code.isBlank()) return UNKNOWN;
        return code.trim() + " · " + categorize(code);
    }
}
