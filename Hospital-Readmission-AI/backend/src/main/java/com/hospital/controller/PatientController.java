package com.hospital.controller;

import com.hospital.dto.PageResponse;
import com.hospital.dto.PatientDetail;
import com.hospital.dto.PatientRequests.CreatePatientRequest;
import com.hospital.dto.PatientRequests.UpdatePatientRequest;
import com.hospital.dto.PatientRow;
import com.hospital.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/patients")
public class PatientController {

    private final PatientService patients;

    public PatientController(PatientService patients) {
        this.patients = patients;
    }

    @GetMapping
    public PageResponse<PatientRow> list(@RequestParam(required = false) String search,
                                         @RequestParam(required = false) String riskLevel,
                                         @RequestParam(required = false) String department,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "10") int size) {
        return patients.list(search, riskLevel, department, page, size);
    }

    @GetMapping("/{id}")
    public PatientDetail get(@PathVariable long id) {
        return patients.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','NURSE')")
    public PatientDetail create(@Valid @RequestBody CreatePatientRequest request) {
        return patients.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','NURSE')")
    public PatientDetail update(@PathVariable long id, @Valid @RequestBody UpdatePatientRequest request) {
        return patients.update(id, request);
    }
}
