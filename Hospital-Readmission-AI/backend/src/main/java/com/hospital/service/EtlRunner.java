package com.hospital.service;

import com.hospital.config.AppProperties;
import com.hospital.repository.UploadRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Runs the project's Python ETL for one upload:
 *   {python} main.py --input {file} --mappings {IDS_mapping.csv} --upload-id {id}
 * in {app.etl.working-dir}. The ETL itself sets Uploads.Status (PROCESSING -> COMPLETED/FAILED)
 * and writes DataQualityLogs. This class only starts it, waits with a timeout, records a failure
 * if the process could not run or ended without finishing the upload, and notifies the uploader.
 *
 * Disabled unless ETL_ENABLED=true; then the upload stays PENDING with instructions to run the ETL manually.
 */
@Component
public class EtlRunner {

    private static final Logger log = LoggerFactory.getLogger(EtlRunner.class);

    public record StartResult(boolean started, String message) {
    }

    private final AppProperties.Etl config;
    private final UploadRepository uploads;
    private final NotificationService notifications;
    private final ExecutorService executor;

    public EtlRunner(AppProperties props, UploadRepository uploads, NotificationService notifications,
                     ExecutorService etlExecutor) {
        this.config = props.etl();
        this.uploads = uploads;
        this.notifications = notifications;
        this.executor = etlExecutor;
    }

    public StartResult start(long uploadId, Path csv, int uploaderId) {
        Path workDir = Path.of(config.workingDir()).toAbsolutePath().normalize();
        String manual = "cd " + workDir + " && " + config.python() + " main.py --input \"" + csv
                + "\" --mappings <path to IDS_mapping.csv> --upload-id " + uploadId;
        if (!config.enabled()) {
            return new StartResult(false, "Stored. Automatic ETL is disabled (ETL_ENABLED=false); load it with: " + manual);
        }
        if (config.mappingsFile() == null || config.mappingsFile().isBlank()
                || !Files.isRegularFile(Path.of(config.mappingsFile()))) {
            return new StartResult(false, "Stored. ETL_MAPPINGS_FILE is not set to an existing IDS_mapping.csv; load it with: " + manual);
        }
        if (!Files.isRegularFile(workDir.resolve("main.py"))) {
            return new StartResult(false, "Stored. ETL_DIR does not contain main.py (" + workDir + "); load it with: " + manual);
        }
        executor.submit(() -> run(uploadId, csv, workDir, uploaderId));
        return new StartResult(true, "Stored. The ETL is cleaning, validating and loading the file.");
    }

    private void run(long uploadId, Path csv, Path workDir, int uploaderId) {
        List<String> command = new ArrayList<>(List.of(config.python(), "main.py", "--input", csv.toString(),
                "--mappings", Path.of(config.mappingsFile()).toAbsolutePath().toString(),
                "--upload-id", String.valueOf(uploadId)));
        File logFile = csv.resolveSibling("etl_upload_" + uploadId + ".log").toFile();
        String failure = null;
        try {
            ProcessBuilder pb = new ProcessBuilder(command).directory(workDir.toFile())
                    .redirectErrorStream(true).redirectOutput(logFile);
            // The ETL reads its own connection settings from etl/.env; do not leak the backend's DB_* variables.
            Map<String, String> env = pb.environment();
            env.keySet().removeIf(k -> k.startsWith("DB_"));
            log.info("Starting ETL for upload {}: {}", uploadId, String.join(" ", command));
            Process process = pb.start();
            if (!process.waitFor(config.timeoutMinutes(), TimeUnit.MINUTES)) {
                process.destroyForcibly();
                failure = "ETL did not finish within " + config.timeoutMinutes() + " minutes and was stopped. Log: " + logFile;
            } else if (process.exitValue() != 0) {
                failure = "ETL exited with code " + process.exitValue() + ". See " + logFile;
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            failure = "ETL run was interrupted.";
        } catch (Exception ex) {
            failure = "Could not run the ETL (" + ex.getMessage() + "). Check ETL_PYTHON and ETL_DIR.";
        }
        try {
            if (failure != null) {
                log.warn("Upload {} failed: {}", uploadId, failure);
                uploads.markFailedIfUnfinished(uploadId, failure);
            }
            String status = uploads.status(uploadId);
            if ("COMPLETED".equals(status)) {
                notifications.notifyUser(uploaderId, null, NotificationService.UPLOAD_COMPLETED,
                        "Upload #" + uploadId + " (" + csv.getFileName() + ") was cleaned, validated and loaded.");
            } else {
                if (!"FAILED".equals(status)) {
                    uploads.markFailedIfUnfinished(uploadId, "ETL ended without completing the upload. See " + logFile);
                }
                notifications.notifyUser(uploaderId, null, NotificationService.UPLOAD_FAILED,
                        "Upload #" + uploadId + " (" + csv.getFileName() + ") was not loaded. Open the quality report for details.");
            }
        } catch (RuntimeException ex) {
            log.error("Could not record the result of upload {}", uploadId, ex);
        }
    }
}
