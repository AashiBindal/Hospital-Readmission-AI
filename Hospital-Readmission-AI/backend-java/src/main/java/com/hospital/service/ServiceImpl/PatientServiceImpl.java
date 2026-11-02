package com.hospital.service.ServiceImpl;

import com.hospital.dto.Request.PatientRequestDto;
import com.hospital.dto.Response.PatientResponseDto;
import com.hospital.entity.Department;
import com.hospital.entity.Patient;
import com.hospital.entity.User;
import com.hospital.repository.DepartmentRepository;
import com.hospital.repository.PatientRepository;
import com.hospital.repository.UserRepository;
import com.hospital.service.PatientService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PatientServiceImpl implements PatientService {

    private final PatientRepository patientRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public PatientResponseDto createPatient(PatientRequestDto dto) {
        validatePatientRules(dto);

        Department department = departmentRepository.findById(dto.getDepartmentId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid department ID."));
        if (!department.isActive()) {
            throw new IllegalArgumentException("Selected department is inactive.");
        }

        User physician = userRepository.findById(dto.getAttendingPhysicianId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid attending physician ID."));
        if (physician.getRole() != User.Role.DOCTOR) {
            throw new IllegalArgumentException("Attending physician must have the DOCTOR role.");
        }

        String displayId = generateNextDisplayId();

        Patient patient = Patient.builder()
                .displayId(displayId)
                .name(dto.getName())
                .age(dto.getAge())
                .gender(dto.getGender())
                .department(department)
                .primaryDiagnosis(dto.getPrimaryDiagnosis())
                .admissionDate(dto.getAdmissionDate())
                .dischargeDate(dto.getDischargeDate())
                .lengthOfStay(dto.getLengthOfStay())
                .priorAdmissions(dto.getPriorAdmissions())
                .medicationsCount(dto.getMedicationsCount())
                .comorbiditiesCount(dto.getComorbiditiesCount())
                .hba1c(dto.getHba1c())
                .systolicBp(dto.getSystolicBp())
                .egfr(dto.getEgfr())
                .riskScore(null) // Must remain null until prediction
                .riskLevel(null) // Must remain null until prediction
                .attendingPhysician(physician)
                .followUpStatus(dto.getFollowUpStatus())
                .nextFollowUp(dto.getNextFollowUp())
                .observedReadmitted(dto.getObservedReadmitted())
                .notes(dto.getNotes())
                .build();

        Patient saved = patientRepository.save(patient);
        return mapToDto(saved);
    }

    @Override
    public Page<PatientResponseDto> getPatients(String search, UUID departmentId, Patient.RiskLevel riskLevel, Pageable pageable) {
        Specification<Patient> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                Predicate nameMatch = cb.like(cb.lower(root.get("name")), pattern);
                Predicate idMatch = cb.like(cb.lower(root.get("displayId")), pattern);
                predicates.add(cb.or(nameMatch, idMatch));
            }

            if (departmentId != null) {
                predicates.add(cb.equal(root.get("department").get("id"), departmentId));
            }

            if (riskLevel != null) {
                predicates.add(cb.equal(root.get("riskLevel"), riskLevel));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return patientRepository.findAll(spec, pageable).map(this::mapToDto);
    }

    @Override
    public PatientResponseDto getPatientById(UUID id) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Patient not found with ID: " + id));
        return mapToDto(patient);
    }

    @Override
    @Transactional
    public PatientResponseDto updatePatient(UUID id, PatientRequestDto dto) {
        Patient existing = patientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Patient not found with ID: " + id));

        validatePatientRules(dto);

        Department department = departmentRepository.findById(dto.getDepartmentId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid department ID."));
        User physician = userRepository.findById(dto.getAttendingPhysicianId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid attending physician ID."));
        if (physician.getRole() != User.Role.DOCTOR) {
            throw new IllegalArgumentException("Attending physician must have the DOCTOR role.");
        }

        existing.setName(dto.getName());
        existing.setAge(dto.getAge());
        existing.setGender(dto.getGender());
        existing.setDepartment(department);
        existing.setPrimaryDiagnosis(dto.getPrimaryDiagnosis());
        existing.setAdmissionDate(dto.getAdmissionDate());
        existing.setDischargeDate(dto.getDischargeDate());
        existing.setLengthOfStay(dto.getLengthOfStay());
        existing.setPriorAdmissions(dto.getPriorAdmissions());
        existing.setMedicationsCount(dto.getMedicationsCount());
        existing.setComorbiditiesCount(dto.getComorbiditiesCount());
        existing.setHba1c(dto.getHba1c());
        existing.setSystolicBp(dto.getSystolicBp());
        existing.setEgfr(dto.getEgfr());
        existing.setAttendingPhysician(physician);
        existing.setFollowUpStatus(dto.getFollowUpStatus());
        existing.setNextFollowUp(dto.getNextFollowUp());
        existing.setObservedReadmitted(dto.getObservedReadmitted());
        existing.setNotes(dto.getNotes());

        Patient updated = patientRepository.save(existing);
        return mapToDto(updated);
    }

    @Transactional
    public synchronized String generateNextDisplayId() {
        List<String> topIds = patientRepository.findTopDisplayIds(PageRequest.of(0, 1));
        int nextNum = 1001;
        if (!topIds.isEmpty()) {
            try {
                String maxId = topIds.get(0);
                String numPart = maxId.replace("PT-", "");
                nextNum = Integer.parseInt(numPart) + 1;
            } catch (Exception ignored) {}
        }
        return String.format("PT-%04d", nextNum);
    }

    private void validatePatientRules(PatientRequestDto dto) {
        if (dto.getAdmissionDate() != null && dto.getDischargeDate() != null) {
            if (dto.getDischargeDate().isBefore(dto.getAdmissionDate())) {
                throw new IllegalArgumentException("Discharge date cannot be prior to admission date.");
            }
        }
    }

    private PatientResponseDto mapToDto(Patient p) {
        return PatientResponseDto.builder()
                .id(p.getId())
                .displayId(p.getDisplayId())
                .patientName(p.getName())
                .age(p.getAge())
                .gender(String.valueOf(p.getGender()))
                .departmentId(p.getDepartment() != null ? String.valueOf(p.getDepartment().getId()) : null)
                .departmentName(p.getDepartment() != null ? p.getDepartment().getName() : null)
                .primaryDiagnosis(p.getPrimaryDiagnosis())
                .admissionDate(p.getAdmissionDate())
                .dischargeDate(p.getDischargeDate())
                .lengthOfStay(p.getLengthOfStay())
                .previousAdmissions(p.getPriorAdmissions())
                .medicationsCount(p.getMedicationsCount())
                .comorbiditiesCount(p.getComorbiditiesCount())
                .hba1c(p.getHba1c())
                .systolicBp(p.getSystolicBp())
                .egfr(p.getEgfr())
                .riskScore(p.getRiskScore())
                .riskLevel(p.getRiskLevel())
                .attendingPhysicianId(p.getAttendingPhysician() != null ? p.getAttendingPhysician().getId() : null)
                .attendingPhysicianName(p.getAttendingPhysician() != null ? p.getAttendingPhysician().getName() : null)
                .followUpStatus(p.getFollowUpStatus())
                .nextFollowUp(p.getNextFollowUp())
                .observedReadmitted(p.getObservedReadmitted())
                .notes(p.getNotes())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}