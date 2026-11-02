package com.hospital.controller;

import com.hospital.dto.PredictionDtos.PredictionRequest;
import com.hospital.dto.PredictionDtos.PredictionResult;
import com.hospital.dto.PredictionSummary;
import com.hospital.service.PredictionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/predictions")
public class PredictionController {

    private final PredictionService predictions;

    public PredictionController(PredictionService predictions) {
        this.predictions = predictions;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','NURSE')")
    public PredictionResult predict(@Valid @RequestBody PredictionRequest request) {
        return predictions.predict(request.admissionId());
    }

    @GetMapping("/patient/{patientId}")
    public List<PredictionSummary> forPatient(@PathVariable long patientId) {
        return predictions.forPatient(patientId);
    }
}
