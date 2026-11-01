package com.hospital.service.ServiceImpl;

import com.hospital.entity.Department;
import com.hospital.repository.DepartmentRepository;
import com.hospital.service.DepartmentService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DepartmentServiceImpl implements DepartmentService {

    private final DepartmentRepository departmentRepository;

    @PostConstruct
    @Transactional
    public void seedDepartments() {
        record DeptInfo(String code, String name) {}
        List<DeptInfo> requiredDepts = List.of(
                new DeptInfo("CARDIOLOGY", "Cardiology"),
                new DeptInfo("MEDICINE", "Medicine"),
                new DeptInfo("PEDIATRICS", "Pediatrics"),
                new DeptInfo("ORTHOPEDICS", "Orthopedics"),
                new DeptInfo("PULMONOLOGY", "Pulmonology"),
                new DeptInfo("NEPHROLOGY", "Nephrology"),
                new DeptInfo("ENDOCRINOLOGY", "Endocrinology"),
                new DeptInfo("GENERAL", "General")
        );

        for (DeptInfo d : requiredDepts) {
            departmentRepository.findByCode(d.code()).ifPresentOrElse(
                    existing -> {
                        if (!existing.getName().equals(d.name())) {
                            existing.setName(d.name());
                            departmentRepository.save(existing);
                        }
                    },
                    () -> {
                        Department newDept = Department.builder()
                                .code(d.code())
                                .name(d.name())
                                .active(true)
                                .build();
                        departmentRepository.save(newDept);
                    }
            );
        }
    }

    public List<Department> getActiveDepartments() {
        return departmentRepository.findByActiveTrue();
    }
}