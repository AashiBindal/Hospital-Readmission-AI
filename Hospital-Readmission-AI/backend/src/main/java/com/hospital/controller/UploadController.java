package com.hospital.controller;

import com.hospital.dto.UploadDtos.QualityReport;
import com.hospital.dto.UploadDtos.UploadAccepted;
import com.hospital.dto.UploadDtos.UploadRow;
import com.hospital.security.CurrentUser;
import com.hospital.service.UploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/uploads")
@PreAuthorize("hasAnyRole('ADMIN','DOCTOR','NURSE')")
public class UploadController {

    private final UploadService uploads;

    public UploadController(UploadService uploads) {
        this.uploads = uploads;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public UploadAccepted upload(@RequestParam("file") MultipartFile file) {
        return uploads.accept(file, CurrentUser.get());
    }

    @GetMapping
    public List<UploadRow> history() {
        return uploads.history();
    }

    @GetMapping("/{id}")
    public UploadRow get(@PathVariable long id) {
        return uploads.get(id);
    }

    @GetMapping("/{id}/quality-report")
    public QualityReport qualityReport(@PathVariable long id) {
        return uploads.qualityReport(id);
    }
}
