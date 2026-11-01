package com.hospital.service;

import com.hospital.dto.Response.DataUploadResponseDto;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.UUID;

public interface DataUploadService {
    DataUploadResponseDto processDatasetUpload(MultipartFile file, String uploaderUsername);
    List<DataUploadResponseDto> getAllUploads();
    DataUploadResponseDto getUploadById(UUID id);
}