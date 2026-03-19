import { apiClient } from "./client";
import { AuditLog } from "../types/audit";
import { PaginatedResponse } from "../types/pagination";

export const fetchAuditLogs = async (entityType: string, entityId: string) => {
  const response = await apiClient.get<PaginatedResponse<AuditLog>>(`/audit/${entityType}/${entityId}`);
  return response.data.items;
};
