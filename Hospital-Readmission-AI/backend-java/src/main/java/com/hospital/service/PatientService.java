package com.hospital.service;

import com.hospital.dto.Request.PatientRequestDto;
import com.hospital.dto.Response.PatientResponseDto;
import com.hospital.entity.Patient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;

public interface PatientService {
    PatientResponseDto createPatient(PatientRequestDto requestDto);
    Page<PatientResponseDto> getPatients(String search, UUID departmentId, Patient.RiskLevel riskLevel, Pageable pageable);
    PatientResponseDto getPatientById(UUID id);
    PatientResponseDto updatePatient(UUID id, PatientRequestDto requestDto);
}