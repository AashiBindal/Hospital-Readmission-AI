package com.hospital.controller;

import com.hospital.dto.Response.DataUploadResponseDto;
import com.hospital.service.DataUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/datasets")
@RequiredArgsConstructor
public class DataUploadController {

    private final DataUploadService dataUploadService;

    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DataUploadResponseDto> uploadDataset(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "admin";
        return ResponseEntity.ok(dataUploadService.processDatasetUpload(file, username));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<DataUploadResponseDto>> getAllUploads() {
        return ResponseEntity.ok(dataUploadService.getAllUploads());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DataUploadResponseDto> getUploadById(@PathVariable UUID id) {
        return ResponseEntity.ok(dataUploadService.getUploadById(id));
    }
}