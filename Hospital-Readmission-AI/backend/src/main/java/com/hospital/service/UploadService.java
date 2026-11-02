package com.hospital.service;

import com.hospital.config.AppProperties;
import com.hospital.dto.UploadDtos.QualityIssue;
import com.hospital.dto.UploadDtos.QualityReport;
import com.hospital.dto.UploadDtos.UploadAccepted;
import com.hospital.dto.UploadDtos.UploadRow;
import com.hospital.exception.ApiException;
import com.hospital.repository.UploadRepository;
import com.hospital.security.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Dataset uploads. The backend stores the CSV and creates a dbo.Uploads row (PENDING);
 * cleaning, validation and loading are done by the project's Python ETL (etl/main.py --upload-id),
 * which updates the same Uploads row and writes dbo.DataQualityLogs. See {@link EtlRunner}.
 */
@Service
public class UploadService {

    private static final Logger log = LoggerFactory.getLogger(UploadService.class);

    /** Minimum header of diabetic_data.csv; the ETL validates all 50 source columns. */
    static final Set<String> REQUIRED_COLUMNS = Set.of("encounter_id", "patient_nbr", "readmitted");

    private final UploadRepository uploads;
    private final EtlRunner etlRunner;
    private final Path uploadDir;

    public UploadService(UploadRepository uploads, EtlRunner etlRunner, AppProperties props) {
        this.uploads = uploads;
        this.etlRunner = etlRunner;
        this.uploadDir = Path.of(props.upload().dir()).toAbsolutePath().normalize();
    }

    public UploadAccepted accept(MultipartFile file, AuthenticatedUser caller) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("Choose a non-empty CSV file.");
        String original = file.getOriginalFilename() == null ? "upload.csv" : file.getOriginalFilename();
        String safeName = Path.of(original).getFileName().toString().replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safeName.toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw ApiException.badRequest("Only .csv files are accepted (the ETL reads the diabetic_data.csv format).");
        }
        checkHeader(file);

        long uploadId = uploads.insertPending(safeName, file.getSize(), caller.id());
        Path target = uploadDir.resolve(uploadId + "_" + safeName).normalize();
        if (!target.startsWith(uploadDir)) throw ApiException.badRequest("Invalid file name.");
        try {
            Files.createDirectories(uploadDir);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            uploads.markFailedIfUnfinished(uploadId, "Could not store the uploaded file on the server: " + ex.getMessage());
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store the uploaded file on the server.", ex);
        }
        log.info("Upload {} stored at {}", uploadId, target);

        EtlRunner.StartResult start = etlRunner.start(uploadId, target, caller.id());
        if (!start.started()) uploads.setMessage(uploadId, start.message());
        String status = start.started() ? "Processing" : "Pending";
        return new UploadAccepted(String.valueOf(uploadId), String.valueOf(uploadId), status, start.started(), start.message());
    }

    private static void checkHeader(MultipartFile file) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null) throw ApiException.badRequest("The file is empty.");
            if (header.startsWith("﻿")) header = header.substring(1);
            Set<String> columns = Arrays.stream(header.split(","))
                    .map(c -> c.trim().replace("\"", "").toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
            List<String> missing = REQUIRED_COLUMNS.stream().filter(c -> !columns.contains(c)).sorted().toList();
            if (!missing.isEmpty()) {
                throw ApiException.badRequest("The CSV header is missing required column(s): " + String.join(", ", missing)
                        + ". Upload the diabetic_data.csv format.");
            }
            if (reader.readLine() == null) throw ApiException.badRequest("The file has a header but no data rows.");
        } catch (IOException ex) {
            throw ApiException.badRequest("The file could not be read as UTF-8 text.");
        }
    }

    public List<UploadRow> history() {
        return uploads.findRecent(100);
    }

    public UploadRow get(long id) {
        return uploads.findById(id).orElseThrow(() -> ApiException.notFound("Upload " + id));
    }

    public QualityReport qualityReport(long id) {
        UploadRow row = get(id);
        List<QualityIssue> issues = uploads.findIssues(id);
        int errors = 0, warnings = 0, infos = 0;
        long errorRows = 0, warningRows = 0;
        for (QualityIssue i : issues) {
            switch (i.severity()) {
                case "ERROR" -> { errors++; errorRows += i.affectedRows(); }
                case "WARNING" -> { warnings++; warningRows += i.affectedRows(); }
                default -> infos++;
            }
        }
        return new QualityReport(row.id(), row.fileName(), row.status(), row.errorMessage(), row.recordsCount(),
                row.loadedCount(), row.rejectedCount(), errors, warnings, infos, errorRows, warningRows, issues);
    }
}
