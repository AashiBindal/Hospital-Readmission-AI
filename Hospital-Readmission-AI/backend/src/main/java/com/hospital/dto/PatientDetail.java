package com.hospital.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.util.List;

/**
 * GET /patients/{id}: every field of {@link PatientRow} (serialised flat, at the top level)
 * plus all admissions of the patient, newest first.
 */
public record PatientDetail(@JsonUnwrapped PatientRow summary, List<AdmissionDto> admissions) {
}
