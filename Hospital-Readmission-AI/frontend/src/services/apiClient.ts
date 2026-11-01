import axios, { AxiosError } from "axios";

/**
 * Shared Axios instance for all calls to the Spring Boot backend.
 * The frontend NEVER talks to the ML service or database directly —
 * everything goes through backend-java at VITE_API_BASE_URL.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "hra_token";

apiClient.interceptors.request.use((config) => {
  // TODO (Member 1 + Member 2): agree on auth token format (e.g. JWT bearer).
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // TODO: redirect to /login once auth exists.
    }
    return Promise.reject(error);
  },
);

export { TOKEN_KEY };
export default apiClient;
