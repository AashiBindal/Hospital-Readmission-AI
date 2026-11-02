package com.hospital.controller;

import com.hospital.dto.Request.PredictionRequestDto;
import com.hospital.dto.Response.PredictionResponseDto;
import com.hospital.service.RiskPredictionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class RiskPredictionController {

    private final RiskPredictionService riskPredictionService;

    @PostMapping("/manual")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<PredictionResponseDto> predictReadmission(@Valid @RequestBody PredictionRequestDto requestDto) {
        PredictionResponseDto response = riskPredictionService.predictReadmission(requestDto);
        return ResponseEntity.ok(response);
    }
}