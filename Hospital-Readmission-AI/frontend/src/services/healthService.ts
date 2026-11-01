import apiClient from "./apiClient";
import type { HealthResponse } from "@/types";

/** Calls GET {VITE_API_BASE_URL}/health on the Spring Boot backend. */
export async function getBackendHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>("/health");
  return data;
}
