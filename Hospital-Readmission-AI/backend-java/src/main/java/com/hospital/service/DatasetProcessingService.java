package com.hospital.service;

import com.hospital.dto.Request.DataQualityReportDto;
import org.springframework.web.multipart.MultipartFile;

public interface DatasetProcessingService {
    DataQualityReportDto processDataset(MultipartFile file, String uploaderUsername);
}