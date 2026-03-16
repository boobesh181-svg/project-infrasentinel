import { apiClient } from "./client";
import { AuditLog } from "../types/audit";

export const fetchAuditLogs = async (entityType: string, entityId: string) => {
  const response = await apiClient.get<AuditLog[]>(`/audit/${entityType}/${entityId}`);
  return response.data;
};
