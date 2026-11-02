import axiosClient from './axiosClient';

export const notificationService = {
  // Notifications of the signed-in user:
  // Array of { id, category, type, title, description, time, createdAt, unread, targetPath, targetState, patientId }
  async getNotifications() {
    const response = await axiosClient.get('/notifications');
    return response.data;
  },

  async markAsRead(id) {
    const response = await axiosClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  async markAsUnread(id) {
    const response = await axiosClient.patch(`/notifications/${id}/unread`);
    return response.data;
  },

  async markAllAsRead() {
    const response = await axiosClient.patch('/notifications/read-all');
    return response.data;
  },

  async deleteNotification(id) {
    await axiosClient.delete(`/notifications/${id}`);
  }
};

export default notificationService;
