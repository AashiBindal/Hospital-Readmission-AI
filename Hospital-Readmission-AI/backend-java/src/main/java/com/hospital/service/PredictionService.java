package com.hospital.service;

import com.hospital.dto.Request.PredictionRequestDto;
import com.hospital.dto.Response.PredictionResponseDto;
import com.hospital.entity.PredictionHistory;

import java.util.List;

public interface PredictionService {
    PredictionResponseDto predictReadmission(PredictionRequestDto requestDto);
    PredictionResponseDto predictForExistingPatient(Long patientDbId);
    List<PredictionHistory> getPatientPredictionHistory(String patientId);
}