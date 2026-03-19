import { apiClient } from "./client";
import { Evidence } from "../types/evidence";
import { PaginatedResponse } from "../types/pagination";

export const fetchEvidence = async (entryId: string) => {
  const response = await apiClient.get<PaginatedResponse<Evidence>>(`/material-entries/${entryId}/evidence`);
  return response.data.items;
};

export const uploadEvidence = async (entryId: string, file: File, evidenceType = "other") => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<Evidence>(
    `/material-entries/${entryId}/evidence?evidence_type=${encodeURIComponent(evidenceType)}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" }
    }
  );
  return response.data;
};

export const downloadEvidence = async (evidenceId: string) => {
  const response = await apiClient.get<Blob>(`/evidence/${evidenceId}/download`, {
    responseType: "blob"
  });
  return response.data;
};
