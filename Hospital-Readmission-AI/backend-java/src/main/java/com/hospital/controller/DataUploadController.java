package com.hospital.controller;

import com.hospital.dto.Request.DataQualityReportDto;
import com.hospital.service.DatasetProcessingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/datasets")
@RequiredArgsConstructor
public class DataUploadController {

    private final DatasetProcessingService processingService;

    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DataQualityReportDto> uploadDataset(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {

        String username = authentication != null ? authentication.getName() : "system_admin";
        DataQualityReportDto report = processingService.processDataset(file, username);
        return ResponseEntity.ok(report);
    }
}