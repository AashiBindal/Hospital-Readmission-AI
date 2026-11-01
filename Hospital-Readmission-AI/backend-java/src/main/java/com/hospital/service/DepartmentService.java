package com.hospital.service;

import com.hospital.entity.Department;
import java.util.List;

public interface DepartmentService {
    List<Department> getActiveDepartments();
}