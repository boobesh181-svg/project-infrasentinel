import { apiClient } from "./client";
import { Project, ProjectCreate } from "../types/project";
import { MaterialEntry } from "../types/materialEntry";

export const fetchProjects = async () => {
  const response = await apiClient.get<Project[]>("/projects");
  return response.data;
};

export const fetchProject = async (projectId: string) => {
  const response = await apiClient.get<Project>(`/projects/${projectId}`);
  return response.data;
};

export const fetchProjectEntries = async (projectId: string) => {
  const response = await apiClient.get<MaterialEntry[]>(`/projects/${projectId}/material-entries`);
  return response.data;
};

export const createProject = async (payload: ProjectCreate) => {
  const response = await apiClient.post<Project>("/projects", payload);
  return response.data;
};
