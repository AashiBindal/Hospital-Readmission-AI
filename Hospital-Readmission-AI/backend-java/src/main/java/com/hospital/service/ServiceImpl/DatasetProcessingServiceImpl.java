package com.hospital.service.ServiceImpl;

import com.hospital.dto.Request.DataQualityReportDto;
import com.hospital.entity.PatientHospitalRecord;   // adjust to your actual package
import com.hospital.entity.UploadBatch;             // adjust to your actual package
import com.hospital.repository.PatientHospitalRecordRepository;
import com.hospital.repository.UploadBatchRepository;
import com.hospital.service.DatasetProcessingService;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DatasetProcessingServiceImpl implements DatasetProcessingService {

    private final UploadBatchRepository batchRepository;
    private final PatientHospitalRecordRepository recordRepository;

    // NOTE: no @Transactional on purpose. If the whole method were transactional,
    // the FAILED status saved in the catch block would be rolled back together with
    // the exception. saveAll() is already transactional on its own.
    @Override
    public DataQualityReportDto processDataset(MultipartFile file, String uploaderUsername) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty.");
        }

        String filename = file.getOriginalFilename();
        String lowerName = filename == null ? "" : filename.toLowerCase();
        if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
            throw new IllegalArgumentException("Invalid file format. Only CSV and Excel files are supported.");
        }

        UploadBatch batch = UploadBatch.builder()
                .filename(filename)
                .uploadTimestamp(LocalDateTime.now())
                .uploadedBy(uploaderUsername)
                .status(UploadBatch.BatchStatus.PROCESSING)
                .build();
        batch = batchRepository.save(batch);

        try {
            List<Map<String, String>> rawRows = parseFile(file, lowerName);
            int originalTotal = rawRows.size();

            int missingDetected = 0;
            int missingHandled = 0;
            int invalidDetected = 0;
            int invalidCorrected = 0;
            int unresolved = 0;
            int duplicatesDetected = 0;
            int duplicatesRemoved = 0;

            Set<String> seenPatientEncounters = new HashSet<>();
            List<PatientHospitalRecord> validRecords = new ArrayList<>();

            for (Map<String, String> row : rawRows) {
                // 1. Missing critical values
                if (isMissing(row, "patient_id") || isMissing(row, "age") || isMissing(row, "gender")
                        || isMissing(row, "admission_date") || isMissing(row, "diagnosis")) {
                    missingDetected++;
                    unresolved++;
                    continue;
                }

                String patientId = row.get("patient_id").trim();
                String admissionRaw = row.get("admission_date").trim();

                // 2. Duplicate check (trimmed values, so "P1 " and "P1" match)
                String uniqueKey = patientId + "_" + admissionRaw;
                if (!seenPatientEncounters.add(uniqueKey)) {
                    duplicatesDetected++;
                    duplicatesRemoved++;
                    continue;
                }

                // 3. Validation & parsing
                try {
                    int age = Integer.parseInt(row.get("age").trim());
                    if (age < 0 || age > 120) {
                        invalidDetected++;
                        unresolved++;
                        continue;
                    }

                    LocalDate admissionDate = LocalDate.parse(admissionRaw);

                    LocalDate dischargeDate;
                    if (isMissing(row, "discharge_date")) {
                        missingDetected++;
                        missingHandled++;
                        dischargeDate = admissionDate.plusDays(3); // default fallback
                    } else {
                        dischargeDate = LocalDate.parse(row.get("discharge_date").trim());
                    }

                    if (dischargeDate.isBefore(admissionDate)) {
                        invalidDetected++;
                        unresolved++;
                        continue;
                    }

                    int previousAdmissions = 0;
                    if (isMissing(row, "previous_admissions")) {
                        missingDetected++;
                        missingHandled++;
                    } else {
                        previousAdmissions = Integer.parseInt(row.get("previous_admissions").trim());
                        if (previousAdmissions < 0) {
                            invalidDetected++;
                            unresolved++;
                            continue;
                        }
                    }

                    validRecords.add(PatientHospitalRecord.builder()
                            .batchId(batch.getId())
                            .patientId(patientId)
                            .age(age)
                            .gender(row.get("gender").trim().toUpperCase())
                            .admissionDate(admissionDate)
                            .dischargeDate(dischargeDate)
                            .primaryDiagnosis(row.get("diagnosis").trim())
                            .previousAdmissions(previousAdmissions)
                            .readyForPrediction(true)
                            .build());

                } catch (NumberFormatException | java.time.format.DateTimeParseException e) {
                    invalidDetected++;
                    unresolved++;
                }
            }

            recordRepository.saveAll(validRecords);

            batch.setOriginalTotalRecords(originalTotal);
            batch.setSuccessfullyProcessedRecords(validRecords.size());
            batch.setMissingValuesDetected(missingDetected);
            batch.setMissingValuesHandled(missingHandled);
            batch.setDuplicateRecordsDetected(duplicatesDetected);
            batch.setDuplicateRecordsRemoved(duplicatesRemoved);
            batch.setInvalidRecordsDetected(invalidDetected);
            batch.setInvalidRecordsCorrected(invalidCorrected);
            batch.setUnresolvedRecords(unresolved);
            batch.setStatus(UploadBatch.BatchStatus.COMPLETED);
            batchRepository.save(batch);

            return DataQualityReportDto.builder()
                    .batchId(batch.getId())
                    .filename(filename)
                    .originalTotalRecords(originalTotal)
                    .successfullyProcessedRecords(validRecords.size())
                    .missingValuesDetected(missingDetected)
                    .missingValuesHandled(missingHandled)
                    .duplicateRecordsDetected(duplicatesDetected)
                    .duplicateRecordsRemoved(duplicatesRemoved)
                    .invalidRecordsDetected(invalidDetected)
                    .invalidRecordsCorrected(invalidCorrected)
                    .unresolvedRecords(unresolved)
                    .status("COMPLETED")
                    .message("Dataset processed and validated successfully.")
                    .build();

        } catch (Exception e) {
            batch.setStatus(UploadBatch.BatchStatus.FAILED);
            batchRepository.save(batch);
            throw new RuntimeException("Failed to process dataset file: " + e.getMessage(), e);
        }
    }

    private boolean isMissing(Map<String, String> row, String key) {
        String v = row.get(key);
        return v == null || v.isBlank();
    }

    private String normalizeHeader(String h) {
        if (h == null) return "";
        return h.replace("\uFEFF", "")      // strip BOM (common in Excel-exported CSVs)
                .trim()
                .toLowerCase()
                .replaceAll("\\s+", "_");
    }

    private List<Map<String, String>> parseFile(MultipartFile file, String lowerName) throws Exception {
        List<Map<String, String>> records = new ArrayList<>();

        if (lowerName.endsWith(".csv")) {
            CSVFormat format = CSVFormat.DEFAULT.builder()      // requires commons-csv >= 1.9
                    .setHeader()
                    .setSkipHeaderRecord(true)
                    .setIgnoreEmptyLines(true)
                    .setTrim(true)
                    .build();

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
                 CSVParser parser = format.parse(reader)) {

                for (CSVRecord csvRecord : parser) {
                    Map<String, String> map = new HashMap<>();
                    csvRecord.toMap().forEach((k, v) -> map.put(normalizeHeader(k), v));
                    records.add(map);
                }
            }
        } else {
            // .xlsx and .xls: WorkbookFactory detects the format (XSSFWorkbook alone fails on .xls)
            try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
                Sheet sheet = workbook.getSheetAt(0);
                Row headerRow = sheet.getRow(0);
                if (headerRow == null) {
                    throw new IllegalArgumentException("Excel file has no header row.");
                }

                DataFormatter formatter = new DataFormatter();
                FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();

                int colCount = headerRow.getLastCellNum();
                List<String> headers = new ArrayList<>();
                for (int j = 0; j < colCount; j++) {
                    Cell c = headerRow.getCell(j, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    headers.add(c == null ? "" : normalizeHeader(formatter.formatCellValue(c, evaluator)));
                }

                for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                    Row row = sheet.getRow(i);
                    if (row == null) continue;

                    Map<String, String> map = new HashMap<>();
                    boolean allBlank = true;

                    for (int j = 0; j < headers.size(); j++) {
                        if (headers.get(j).isEmpty()) continue;
                        Cell cell = row.getCell(j, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                        String val = "";
                        if (cell != null) {
                            if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                                val = cell.getLocalDateTimeCellValue().toLocalDate().toString(); // ISO yyyy-MM-dd
                            } else {
                                val = formatter.formatCellValue(cell, evaluator).trim();
                            }
                        }
                        if (!val.isEmpty()) allBlank = false;
                        map.put(headers.get(j), val);
                    }
                    if (!allBlank) records.add(map); // skip fully empty rows
                }
            }
        }
        return records;
    }
}