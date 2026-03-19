import { apiClient } from "./client";
import { EmissionsByMaterial, EmissionsByProject, EmissionsByTime } from "../types/analytics";
import { AntiCorruptionSummary, BIMDiscrepancy } from "../types/bim";

export const fetchEmissionsByProject = async () => {
  const response = await apiClient.get<EmissionsByProject[]>("/analytics/emissions-by-project");
  return response.data;
};

export const fetchEmissionsByMaterial = async () => {
  const response = await apiClient.get<EmissionsByMaterial[]>("/analytics/emissions-by-material");
  return response.data;
};

export const fetchEmissionsByTime = async () => {
  const response = await apiClient.get<EmissionsByTime[]>("/analytics/emissions-by-time");
  return response.data;
};

export const fetchBimDiscrepancies = async () => {
  const response = await apiClient.get<BIMDiscrepancy[]>("/analytics/bim-discrepancies");
  return response.data;
};

export const fetchAntiCorruptionSummary = async () => {
  const response = await apiClient.get<AntiCorruptionSummary>("/analytics/anti-corruption-summary");
  return response.data;
};
