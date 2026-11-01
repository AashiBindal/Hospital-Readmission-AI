package com.hospital.service.ServiceImpl;

import com.hospital.dto.Response.DashboardSummaryResponseDto;
import com.hospital.entity.FollowUp;
import com.hospital.entity.Patient;
import com.hospital.repository.FollowUpRepository;
import com.hospital.repository.PatientRepository;
import com.hospital.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final PatientRepository patientRepository;
    private final FollowUpRepository followUpRepository;

    @Override
    public DashboardSummaryResponseDto getDashboardSummary() {
        List<Patient> patients = patientRepository.findAll();

        long totalPatients = patients.size();
        long highRiskPatients = patients.stream()
                .filter(p -> p.getRiskLevel() == Patient.RiskLevel.HIGH)
                .count();

        // Actual Readmission Rate calculation (excluding NULL observed_readmitted)
        long knownOutcomes = patients.stream()
                .filter(p -> p.getObservedReadmitted() != null)
                .count();

        long actualReadmitted = patients.stream()
                .filter(p -> Boolean.TRUE.equals(p.getObservedReadmitted()))
                .count();

        BigDecimal actualReadmissionRate = knownOutcomes > 0
                ? BigDecimal.valueOf(actualReadmitted)
                .divide(BigDecimal.valueOf(knownOutcomes), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                : null;

        // Pending follow-ups (SCHEDULED + PENDING_CALL)
        long pendingFollowUps = followUpRepository.countByStatus(FollowUp.Status.SCHEDULED)
                + followUpRepository.countByStatus(FollowUp.Status.PENDING_CALL);

        // Risk Distribution
        long lowRisk = patients.stream().filter(p -> p.getRiskLevel() == Patient.RiskLevel.LOW).count();
        long medRisk = patients.stream().filter(p -> p.getRiskLevel() == Patient.RiskLevel.MEDIUM).count();
        long highRisk = patients.stream().filter(p -> p.getRiskLevel() == Patient.RiskLevel.HIGH).count();

        DashboardSummaryResponseDto.RiskDistributionDto riskDist = DashboardSummaryResponseDto.RiskDistributionDto.builder()
                .low(lowRisk)
                .medium(medRisk)
                .high(highRisk)
                .build();

        // Top 5 High-Risk Patients sorted by risk score descending
        List<DashboardSummaryResponseDto.HighRiskPatientSummaryDto> topHighRisk = patients.stream()
                .filter(p -> p.getRiskScore() != null)
                .sorted((p1, p2) -> p2.getRiskScore().compareTo(p1.getRiskScore()))
                .limit(5)
                .map(p -> DashboardSummaryResponseDto.HighRiskPatientSummaryDto.builder()
                        .patientId(p.getId())
                        .displayId(p.getDisplayId())
                        .patientName(p.getName())
                        .age(p.getAge())
                        .primaryDiagnosis(p.getPrimaryDiagnosis())
                        .riskScore(p.getRiskScore())
                        .riskLevel(p.getRiskLevel() != null ? p.getRiskLevel().name() : "UNKNOWN")
                        .build())
                .collect(Collectors.toList());

        return DashboardSummaryResponseDto.builder()
                .totalPatients(totalPatients)
                .highRiskPatients(highRiskPatients)
                .actualReadmissionRate(actualReadmissionRate)
                .pendingFollowUps(pendingFollowUps)
                .riskDistribution(riskDist)
                .topHighRiskPatients(topHighRisk)
                .ageGroupDistribution(List.of()) // Populated dynamically or via aggregation
                .build();
    }
}