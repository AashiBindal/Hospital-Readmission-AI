import axiosClient from './axiosClient';

export const predictionService = {
  // Scores one stored admission with the ML service and stores the result.
  // Response: { predictionId, patientId, externalPatientId, admissionId, riskScore (0-100), probability (0-1),
  //   riskLevel, modelVersion, predictedAt, factors: [{ label, contribution }], recommendedAction }
  // Fails with 503 when the ML service is down or has no trained model (no score is invented).
  async calculateRisk(admissionId) {
    const response = await axiosClient.post('/predictions', { admissionId }, { timeout: 30000 });
    return response.data;
  },

  // Stored predictions of a patient, newest first:
  // Array of { predictionId, admissionId, riskScore, riskLevel, modelVersion, predictedAt }
  async getPatientPredictions(patientId) {
    const response = await axiosClient.get(`/predictions/patient/${patientId}`);
    return response.data;
  }
};

export default predictionService;
