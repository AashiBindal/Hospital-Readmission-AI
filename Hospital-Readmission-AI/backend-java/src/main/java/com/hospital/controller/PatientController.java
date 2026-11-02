package com.hospital.controller;

import com.hospital.dto.Request.PatientRequestDto;
import com.hospital.dto.Response.PatientResponseDto;
import com.hospital.entity.Patient;
import com.hospital.service.PatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<PatientResponseDto> createPatient(@Valid @RequestBody PatientRequestDto requestDto) {
        return ResponseEntity.ok(patientService.createPatient(requestDto));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<Page<PatientResponseDto>> getPatients(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) Patient.RiskLevel riskLevel,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "ASC") String direction) {

        Sort sort = Sort.by(Sort.Direction.fromString(direction), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        Page<PatientResponseDto> result = patientService.getPatients(search, departmentId, riskLevel, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<PatientResponseDto> getPatientById(@PathVariable UUID id) {
        return ResponseEntity.ok(patientService.getPatientById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
    public ResponseEntity<PatientResponseDto> updatePatient(
            @PathVariable UUID id,
            @Valid @RequestBody PatientRequestDto requestDto) {
        return ResponseEntity.ok(patientService.updatePatient(id, requestDto));
    }
}