import axiosClient from './axiosClient';

export const userService = {
  // Admin: every account. Doctor / Nurse: active staff (id, name, role, department) for assigning follow-ups.
  async getUsers() {
    const response = await axiosClient.get('/users');
    return response.data;
  }
};

export default userService;
