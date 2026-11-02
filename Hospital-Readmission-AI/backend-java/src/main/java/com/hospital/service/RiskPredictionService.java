package com.hospital.service;

import com.hospital.dto.Request.PredictionRequestDto;
import com.hospital.dto.Response.PredictionResponseDto;

public interface RiskPredictionService {
    PredictionResponseDto predictReadmission(PredictionRequestDto dto);
}