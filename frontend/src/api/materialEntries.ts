import { apiClient } from "./client";
import { MaterialEntry, MaterialEntryCreate } from "../types/materialEntry";

export const fetchMaterialEntry = async (entryId: string) => {
  const response = await apiClient.get<MaterialEntry>(`/material-entries/${entryId}`);
  return response.data;
};

export const createMaterialEntry = async (payload: MaterialEntryCreate) => {
  const response = await apiClient.post<MaterialEntry>("/material-entries", payload);
  return response.data;
};

export const submitEntry = async (entryId: string) => {
  const response = await apiClient.post<MaterialEntry>(`/material-entries/${entryId}/submit`);
  return response.data;
};

export const verifyEntry = async (entryId: string) => {
  const response = await apiClient.post<MaterialEntry>(`/material-entries/${entryId}/verify`);
  return response.data;
};

export const approveEntry = async (entryId: string) => {
  const response = await apiClient.post<MaterialEntry>(`/material-entries/${entryId}/approve`);
  return response.data;
};

export const lockEntry = async (entryId: string) => {
  const response = await apiClient.post<MaterialEntry>(`/material-entries/${entryId}/lock`);
  return response.data;
};
