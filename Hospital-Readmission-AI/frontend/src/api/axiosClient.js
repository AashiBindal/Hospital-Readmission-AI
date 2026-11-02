import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  timeout: 15000
});

// Request interceptor to attach Bearer token
axiosClient.interceptors.request.use(
  (config) => {
    try {
      const token = sessionStorage.getItem('medisight_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Failed to retrieve token from sessionStorage:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to trigger toast notification via custom event
function triggerToast(type, title, description) {
  try {
    window.dispatchEvent(
      new CustomEvent('medisight_toast', {
        detail: { type, title, description }
      })
    );
  } catch (e) {
    console.error('Toast trigger failed:', e);
  }
}

// Response interceptor for centralized error handling
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 1. Network / Connection Error
    if (!error.response || error.code === 'ERR_NETWORK') {
      triggerToast(
        'error',
        'Server not reachable',
        'Unable to connect to the Spring Boot REST backend. Please verify the API server is running.'
      );
      error.message = `Cannot reach the backend at ${API_BASE_URL}. Is the Spring Boot server running?`;
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    // Show the backend's explanation (ApiError.message) instead of "Request failed with status code ...".
    if (data && typeof data.message === 'string' && data.message.trim()) {
      error.message = data.message;
    }

    // 2. Unauthorized (401): Session expired or invalid
    if (status === 401) {
      sessionStorage.removeItem('medisight_token');
      sessionStorage.removeItem('medisight_active_session_user');
      localStorage.removeItem('medisight_active_session_user');

      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register'
      ) {
        triggerToast('warning', 'Session Expired', 'Please sign in again to continue.');
        window.location.href = '/login';
      }
    }

    // 3. Forbidden (403): Access restricted for current role
    if (status === 403) {
      const msg = data?.message || 'You do not have permission to access this clinical resource.';
      triggerToast('warning', 'Access Restricted', msg);
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
