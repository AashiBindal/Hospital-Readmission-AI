import axiosClient from './axiosClient';

export const dashboardService = {
  // Summary metrics, data-driven work items and the top 5 high-risk patients.
  // The dataset has no admission dates, so there is no date-range parameter.
  async getSummary() {
    const response = await axiosClient.get('/dashboard/summary');
    return response.data;
  }
};

export default dashboardService;
