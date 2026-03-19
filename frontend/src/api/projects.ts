import { apiClient } from "./client";
import { Project, ProjectCreate } from "../types/project";
import { BIMUploadResult, ProjectBIMDiscrepancy, ProjectBIMEstimate } from "../types/bim";
import { MaterialEntry } from "../types/materialEntry";
import { PaginatedResponse } from "../types/pagination";

export const fetchProjects = async () => {
  const response = await apiClient.get<PaginatedResponse<Project>>("/projects");
  return response.data.items;
};

export const fetchProject = async (projectId: string) => {
  const response = await apiClient.get<Project>(`/projects/${projectId}`);
  return response.data;
};

export const fetchProjectEntries = async (projectId: string) => {
  const response = await apiClient.get<PaginatedResponse<MaterialEntry>>(`/projects/${projectId}/material-entries`);
  return response.data.items;
};

export const createProject = async (payload: ProjectCreate) => {
  const response = await apiClient.post<Project>("/projects", payload);
  return response.data;
};

export const uploadProjectBim = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<BIMUploadResult>(`/projects/${projectId}/bim-upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
};

export const fetchProjectBimEstimates = async (projectId: string) => {
  const response = await apiClient.get<ProjectBIMEstimate[]>(`/projects/${projectId}/bim-estimates`);
  return response.data;
};

export const fetchProjectBimDiscrepancies = async (projectId: string) => {
  const response = await apiClient.get<ProjectBIMDiscrepancy[]>(`/projects/${projectId}/bim-discrepancies`);
  return response.data;
};
