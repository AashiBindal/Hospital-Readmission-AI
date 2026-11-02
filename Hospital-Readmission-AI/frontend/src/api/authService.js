import axiosClient from './axiosClient';

export const authService = {
  // Register a clinical user (Doctor / Nurse)
  async register({ name, email, phone, password, role, department, licenseId }) {
    const response = await axiosClient.post('/auth/register', {
      name,
      email,
      phone,
      password,
      role,
      department,
      licenseId
    });
    return response.data;
  },

  // Authenticate user with email and password
  async login(email, password) {
    const response = await axiosClient.post('/auth/login', {
      email,
      password
    });
    return response.data; // { token, user: { id, name, email, role, department, avatarInitials, lastLogin } }
  },

  // Restore current session from token
  async getCurrentUser() {
    const response = await axiosClient.get('/auth/me');
    return response.data;
  }
};

export default authService;
