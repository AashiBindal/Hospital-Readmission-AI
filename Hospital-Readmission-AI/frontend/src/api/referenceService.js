import axiosClient from './axiosClient';

export const referenceService = {
  // Distinct departments (medical specialty) in the data: Array of { name, admissions }
  async getDepartments() {
    const response = await axiosClient.get('/reference/departments');
    return response.data;
  }
};

export default referenceService;
