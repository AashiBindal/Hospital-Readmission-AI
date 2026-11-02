import axiosClient from './axiosClient';

export const followUpService = {
  // Follow-up queue. status: All | Pending | Overdue | Done. priority: All | Urgent | High | Medium | Low | Routine.
  // Array of { id, patientId, externalPatientId, patientName, riskLevel, riskScore, predictionId,
  //   assignedToUserId, assignedTo, channel, dueDate, priority, status, completedDate, notes, createdAt }
  async getFollowUps({ status = '', priority = '' } = {}) {
    const params = new URLSearchParams();
    if (status && status !== 'All') params.append('status', status);
    if (priority && priority !== 'All') params.append('priority', priority);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await axiosClient.get(`/follow-ups${queryString}`);
    return response.data;
  },

  // { patientId, predictionId?, assignedToUserId?, channel, dueDate (yyyy-mm-dd), priority, notes? }
  async createFollowUp(followUpData) {
    const response = await axiosClient.post('/follow-ups', followUpData);
    return response.data;
  },

  // status: Done | Completed | Scheduled | Missed | Cancelled
  async updateStatus(id, status) {
    const response = await axiosClient.patch(`/follow-ups/${id}/status`, { status });
    return response.data;
  }
};

export default followUpService;
