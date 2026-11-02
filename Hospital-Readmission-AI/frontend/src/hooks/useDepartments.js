import { useEffect, useState } from 'react';
import referenceService from '../api/referenceService';

// Departments (medical specialties) present in the loaded data, most frequent first.
// Returns { departments: string[], departmentsError } - an empty list until loaded.
export default function useDepartments() {
  const [departments, setDepartments] = useState([]);
  const [departmentsError, setDepartmentsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    referenceService
      .getDepartments()
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setDepartments(data.map((d) => d.name));
        }
      })
      .catch((err) => {
        if (!cancelled) setDepartmentsError(err.message || 'Could not load departments.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { departments, departmentsError };
}
