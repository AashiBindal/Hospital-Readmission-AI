/** Shared TypeScript types. Keep in sync with backend DTOs (docs/api_documentation.md). */

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Patient {
  patientId: number;
  externalPatientId?: string;
  gender?: string;
  age?: number;
}

export interface Prediction {
  predictionId: number;
  admissionId: number;
  riskScore: number;
  riskLevel: RiskLevel;
  modelVersion: string;
  predictedAt: string;
}
