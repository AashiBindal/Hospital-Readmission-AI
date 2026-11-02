package com.hospital.service.ServiceImpl;

import com.hospital.dto.Request.FollowUpRequestDto;
import com.hospital.dto.Response.FollowUpResponseDto;
import com.hospital.entity.FollowUp;
import com.hospital.entity.Patient;
import com.hospital.entity.RiskPrediction;
import com.hospital.entity.User;
import com.hospital.repository.FollowUpRepository;
import com.hospital.repository.PatientRepository;
import com.hospital.repository.RiskPredictionRepository;
import com.hospital.repository.UserRepository;
import com.hospital.service.FollowUpService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FollowUpServiceImpl implements FollowUpService {

    private final FollowUpRepository followUpRepository;
    private final PatientRepository patientRepository;
    private final RiskPredictionRepository riskPredictionRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public FollowUpResponseDto createFollowUp(FollowUpRequestDto dto) {
        Patient patient = patientRepository.findById(dto.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found with ID: " + dto.getPatientId()));

        RiskPrediction prediction = null;
        if (dto.getRiskPredictionId() != null) {
            prediction = riskPredictionRepository.findById(dto.getRiskPredictionId())
                    .orElseThrow(() -> new IllegalArgumentException("Risk prediction not found with ID: " + dto.getRiskPredictionId()));
            if (prediction.getPatient() != null && !prediction.getPatient().getId().equals(patient.getId())) {
                throw new IllegalArgumentException("Risk prediction does not belong to the specified patient.");
            }
        }

        User assignedUser = userRepository.findById(dto.getAssignedToId())
                .orElseThrow(() -> new IllegalArgumentException("Assigned user not found with ID: " + dto.getAssignedToId()));
        if (assignedUser.getRole() != User.Role.DOCTOR && assignedUser.getRole() != User.Role.NURSE) {
            throw new IllegalArgumentException("Follow-ups can only be assigned to doctors or nurses.");
        }

        String displayId = generateNextDisplayId();

        FollowUp.Status initialStatus = dto.getDueDate().isBefore(LocalDate.now())
                ? FollowUp.Status.OVERDUE
                : FollowUp.Status.SCHEDULED;

        FollowUp followUp = FollowUp.builder()
                .displayId(displayId)
                .patient(patient)
                .riskPrediction(prediction)
                .riskLevel(prediction != null ? prediction.getRiskLevel() : null)
                .riskScore(prediction != null ? prediction.getProbability() : null)
                .priority(dto.getPriority())
                .assignedTo(assignedUser)
                .channel(dto.getChannel())
                .dueDate(dto.getDueDate())
                .status(initialStatus)
                .notes(dto.getNotes())
                .build();

        FollowUp saved = followUpRepository.save(followUp);
        return mapToDto(saved);
    }

    @Override
    public Page<FollowUpResponseDto> getFollowUps(FollowUp.Status status, FollowUp.Priority priority, UUID assignedToId, Pageable pageable) {
        updateOverdueStatuses();

        Specification<FollowUp> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (priority != null) {
                predicates.add(cb.equal(root.get("priority"), priority));
            }
            if (assignedToId != null) {
                predicates.add(cb.equal(root.get("assignedTo").get("id"), assignedToId));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return followUpRepository.findAll(spec, pageable).map(this::mapToDto);
    }

    @Override
    public FollowUpResponseDto getFollowUpById(UUID id) {
        FollowUp followUp = followUpRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Follow-up not found with ID: " + id));
        return mapToDto(followUp);
    }

    @Override
    @Transactional
    public FollowUpResponseDto updateFollowUp(UUID id, FollowUpRequestDto dto) {
        FollowUp existing = followUpRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Follow-up not found with ID: " + id));

        Patient patient = patientRepository.findById(dto.getPatientId())
                .orElseThrow(() -> new IllegalArgumentException("Patient not found with ID: " + dto.getPatientId()));

        User assignedUser = userRepository.findById(dto.getAssignedToId())
                .orElseThrow(() -> new IllegalArgumentException("Assigned user not found with ID: " + dto.getAssignedToId()));
        if (assignedUser.getRole() != User.Role.DOCTOR && assignedUser.getRole() != User.Role.NURSE) {
            throw new IllegalArgumentException("Follow-ups can only be assigned to doctors or nurses.");
        }

        existing.setPatient(patient);
        existing.setPriority(dto.getPriority());
        existing.setAssignedTo(assignedUser);
        existing.setChannel(dto.getChannel());
        existing.setDueDate(dto.getDueDate());
        existing.setNotes(dto.getNotes());

        if (existing.getStatus() != FollowUp.Status.COMPLETED) {
            if (dto.getDueDate().isBefore(LocalDate.now())) {
                existing.setStatus(FollowUp.Status.OVERDUE);
            } else {
                existing.setStatus(FollowUp.Status.SCHEDULED);
            }
        }

        FollowUp updated = followUpRepository.save(existing);
        return mapToDto(updated);
    }

    @Override
    @Transactional
    public FollowUpResponseDto markCompleted(UUID id) {
        FollowUp followUp = followUpRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Follow-up not found with ID: " + id));

        followUp.setStatus(FollowUp.Status.COMPLETED);
        followUp.setCompletedAt(LocalDateTime.now());

        FollowUp saved = followUpRepository.save(followUp);
        return mapToDto(saved);
    }

    @Transactional
    public void updateOverdueStatuses() {
        List<FollowUp> pendingList = followUpRepository.findAll();
        LocalDate today = LocalDate.now();
        for (FollowUp f : pendingList) {
            if (f.getStatus() != FollowUp.Status.COMPLETED && f.getDueDate().isBefore(today)) {
                if (f.getStatus() != FollowUp.Status.OVERDUE) {
                    f.setStatus(FollowUp.Status.OVERDUE);
                    followUpRepository.save(f);
                }
            }
        }
    }

    @Transactional
    public synchronized String generateNextDisplayId() {
        List<String> topIds = followUpRepository.findTopDisplayIds(PageRequest.of(0, 1));
        int nextNum = 301;
        if (!topIds.isEmpty()) {
            try {
                String maxId = topIds.get(0);
                String numPart = maxId.replace("FU-", "");
                nextNum = Integer.parseInt(numPart) + 1;
            } catch (Exception ignored) {}
        }
        return String.format("FU-%03d", nextNum);
    }

    private FollowUpResponseDto mapToDto(FollowUp f) {
        return FollowUpResponseDto.builder()
                .id(f.getId())
                .displayId(f.getDisplayId())
                .patientId(f.getPatient() != null ? f.getPatient().getId() : null)
                .patientName(f.getPatient() != null ? f.getPatient().getName() : null)
                .riskPredictionId(f.getRiskPrediction() != null ? f.getRiskPrediction().getId() : null)
                .riskLevel(f.getRiskLevel())
                .riskScore(f.getRiskScore())
                .priority(f.getPriority())
                .assignedToId(f.getAssignedTo() != null ? f.getAssignedTo().getId() : null)
                .assignedToName(f.getAssignedTo() != null ? f.getAssignedTo().getName() : null)
                .channel(f.getChannel())
                .dueDate(f.getDueDate())
                .status(f.getStatus())
                .notes(f.getNotes())
                .completedAt(f.getCompletedAt())
                .createdAt(f.getCreatedAt())
                .updatedAt(f.getUpdatedAt())
                .build();
    }
}