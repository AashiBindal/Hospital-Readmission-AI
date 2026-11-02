import axiosClient from './axiosClient';

// All analytics are computed by the backend from the loaded dataset.
// department: exact department value from GET /reference/departments, or 'All Departments'.
function departmentParams(department) {
  return department && department !== 'All Departments' && department !== 'All' ? { department } : {};
}

export const analyticsService = {
  // Cohort KPIs: { totalPatients, totalAdmissions, eligibleAdmissions, observedReadmissionRate,
  //   scoredPatients, unscoredPatients, lowRiskCount, mediumRiskCount, highRiskCount, avgPredictedRisk }
  async getSummary(department = null) {
    const response = await axiosClient.get('/analytics/summary', { params: departmentParams(department) });
    return response.data;
  },

  // Observed 30-day readmission rate by length of stay (the dataset has no admission dates):
  // Array of { label, lengthOfStay, fullLabel, totalDischarges, readmitted, observedRate, predictedRate, scoredCount }
  async getLengthOfStay(department = null) {
    const response = await axiosClient.get('/analytics/length-of-stay', { params: departmentParams(department) });
    return response.data;
  },

  // Array of { ageGroup, label, patients, readmitted, readmissionRate, avgRisk, scoredCount }
  async getAgeGroups(department = null) {
    const response = await axiosClient.get('/analytics/age-groups', { params: departmentParams(department) });
    return response.data;
  },

  // Observed relative risk per factor: Array of { key, name, affectedCount, totalCohort, prevalencePct,
  //   readmissionRateWith, readmissionRateWithout, relativeRisk, multiplier, relativeImpact, clinicalNote }
  async getRiskFactors(department = null) {
    const response = await axiosClient.get('/analytics/risk-factors', { params: departmentParams(department) });
    return response.data;
  },

  // By ICD-9 diagnosis category: Array of { name, count, readmitted, readmissionRate, avgRiskScore, scoredCount }
  async getByDiagnosis(department = null) {
    const response = await axiosClient.get('/analytics/by-diagnosis', { params: departmentParams(department) });
    return response.data;
  }
};

export default analyticsService;
