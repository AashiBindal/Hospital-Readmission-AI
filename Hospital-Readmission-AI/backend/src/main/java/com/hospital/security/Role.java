package com.hospital.security;

import java.util.Locale;

/**
 * Roles stored in dbo.Users.Role (CHECK: ADMIN, DOCTOR, NURSE, ANALYST).
 * The REST API exposes them in the frontend's spelling (Admin, Doctor, Nurse, Analyst).
 */
public enum Role {
    ADMIN("Admin"), DOCTOR("Doctor"), NURSE("Nurse"), ANALYST("Analyst");

    private final String label;

    Role(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public String authority() {
        return "ROLE_" + name();
    }

    /** Accepts "Doctor", "DOCTOR", "doctor". Returns null when unknown. */
    public static Role parse(String value) {
        if (value == null) return null;
        try {
            return Role.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
