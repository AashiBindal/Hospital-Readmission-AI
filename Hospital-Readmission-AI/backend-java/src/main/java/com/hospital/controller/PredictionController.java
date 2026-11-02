//package com.hospital.controller;
//
//import com.hospital.dto.Request.PredictionRequestDto;
//import com.hospital.dto.Response.PredictionResponseDto;
//import com.hospital.entity.PredictionHistory;
//import com.hospital.service.PredictionService;
//import jakarta.validation.Valid;
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.ResponseEntity;
//import org.springframework.security.access.prepost.PreAuthorize;
//import org.springframework.web.bind.annotation.*;
//
//import java.util.List;
//
//@RestController
//@RequestMapping("/api/predictions")
//@RequiredArgsConstructor
//public class PredictionController {
//
//    private final PredictionService predictionService;
//
//    @PostMapping("/manual")
//    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
//    public ResponseEntity<PredictionResponseDto> predictManual(@Valid @RequestBody PredictionRequestDto requestDto) {
//        PredictionResponseDto response = predictionService.predictReadmission(requestDto);
//        return ResponseEntity.ok(response);
//    }
//
//    @PostMapping("/patient/{patientDbId}")
//    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR')")
//    public ResponseEntity<PredictionResponseDto> predictForPatient(@PathVariable Long patientDbId) {
//        PredictionResponseDto response = predictionService.predictForExistingPatient(patientDbId);
//        return ResponseEntity.ok(response);
//    }
//
//    @GetMapping("/history/{patientId}")
//    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
//    public ResponseEntity<List<PredictionHistory>> getHistory(@PathVariable String patientId) {
//        List<PredictionHistory> history = predictionService.getPatientPredictionHistory(patientId);
//        return ResponseEntity.ok(history);
//    }
//}