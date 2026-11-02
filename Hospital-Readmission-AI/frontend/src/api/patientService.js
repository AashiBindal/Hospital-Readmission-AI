import axiosClient from './axiosClient';

export const patientService = {
  // Paginated registry. riskLevel: High | Medium | Low | Unscored | All. department: value from /reference/departments.
  // Response: { content: [patient], totalElements, totalPages, page, size }
  async getPatients({ search = '', riskLevel = '', department = '', page = 0, size = 10 } = {}) {
    const params = { page, size };
    if (search && search.trim()) params.search = search.trim();
    if (riskLevel && riskLevel !== 'All') params.riskLevel = riskLevel;
    if (department && department !== 'All') params.department = department;

    const response = await axiosClient.get('/patients', { params });
    return response.data;
  },

  // Patient row fields plus admissions: [admission with latestPrediction]
  async getPatientById(id) {
    const response = await axiosClient.get(`/patients/${id}`);
    return response.data;
  },

  // Registers a patient with the admission being recorded (see PatientRequests.CreatePatientRequest).
  async createPatient(patientData) {
    const response = await axiosClient.post('/patients', patientData);
    return response.data;
  },

  // Demographic corrections: { gender, race }
  async updatePatient(id, patientData) {
    const response = await axiosClient.put(`/patients/${id}`, patientData);
    return response.data;
  }
};

export default patientService;
