package com.hospital.service;

import com.hospital.dto.PageResponse;
import com.hospital.dto.PatientDetail;
import com.hospital.dto.PatientRequests.CreatePatientRequest;
import com.hospital.dto.PatientRequests.UpdatePatientRequest;
import com.hospital.dto.PatientRow;
import com.hospital.exception.ApiException;
import com.hospital.repository.AdmissionRepository;
import com.hospital.repository.PatientRepository;
import com.hospital.repository.PatientRepository.Criteria;
import com.hospital.util.RiskLevels;
import com.hospital.util.SqlText;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PatientService {

    public static final int MAX_PAGE_SIZE = 100;

    private final PatientRepository patients;
    private final AdmissionRepository admissions;

    public PatientService(PatientRepository patients, AdmissionRepository admissions) {
        this.patients = patients;
        this.admissions = admissions;
    }

    /** riskLevel: High | Medium | Low | Unscored | All/blank. department: exact Admissions.Department value or All/blank. */
    public PageResponse<PatientRow> list(String search, String riskLevel, String department, int page, int size) {
        if (page < 0) throw ApiException.badRequest("page must be 0 or greater.");
        if (size < 1 || size > MAX_PAGE_SIZE) throw ApiException.badRequest("size must be between 1 and " + MAX_PAGE_SIZE + ".");
        String risk = SqlText.blankToNull(riskLevel);
        boolean unscored = false;
        String riskDb = null;
        if (risk != null && !"All".equalsIgnoreCase(risk)) {
            if ("Unscored".equalsIgnoreCase(risk)) {
                unscored = true;
            } else {
                riskDb = RiskLevels.dbValue(risk);
                if (riskDb == null) throw ApiException.badRequest("riskLevel must be High, Medium, Low or Unscored.");
            }
        }
        String dept = SqlText.blankToNull(department);
        if (dept != null && ("All".equalsIgnoreCase(dept) || "All Departments".equalsIgnoreCase(dept))) dept = null;
        String q = SqlText.blankToNull(search);
        if (q != null && q.length() > 100) throw ApiException.badRequest("search must be at most 100 characters.");

        Criteria criteria = new Criteria(q, riskDb, unscored, dept);
        long total = patients.count(criteria);
        List<PatientRow> content = total == 0 ? List.of() : patients.findPage(criteria, page, size);
        return PageResponse.of(content, total, page, size);
    }

    public PatientDetail get(long id) {
        PatientRow row = patients.findRow(id).orElseThrow(() -> ApiException.notFound("Patient " + id));
        return new PatientDetail(row, admissions.findByPatient(id));
    }

    @Transactional
    public PatientDetail create(CreatePatientRequest req) {
        String ext = req.externalPatientId().trim();
        if (patients.existsExternalId(ext)) {
            throw ApiException.conflict("A patient with ID " + ext + " is already registered.");
        }
        try {
            long id = patients.insertWithAdmission(req);
            return get(id);
        } catch (DuplicateKeyException ex) {
            throw ApiException.conflict("A patient with ID " + ext + " is already registered.");
        }
    }

    @Transactional
    public PatientDetail update(long id, UpdatePatientRequest req) {
        if (patients.updateDemographics(id, req.gender(), req.race()) == 0) {
            throw ApiException.notFound("Patient " + id);
        }
        return get(id);
    }
}
