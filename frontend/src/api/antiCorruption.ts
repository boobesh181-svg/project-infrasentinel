import { apiClient } from "./client";
import {
  DuplicateEvidenceEntry,
  EntryRisk,
  EvidenceAcknowledgement,
  HighRiskEntry,
  SupplierConfirmationPayload
} from "../types/antiCorruption";

export const acknowledgeEntryEvidence = async (entryId: string, comment?: string) => {
  const response = await apiClient.post<EvidenceAcknowledgement>(`/entries/${entryId}/acknowledge`, {
    comment
  });
  return response.data;
};

export const disputeEntryEvidence = async (entryId: string, comment?: string) => {
  const response = await apiClient.post<EvidenceAcknowledgement>(`/entries/${entryId}/dispute`, {
    comment
  });
  return response.data;
};

export const fetchEntryAcknowledgements = async (entryId: string) => {
  const response = await apiClient.get<{ total: number; items: EvidenceAcknowledgement[] }>(
    `/entries/${entryId}/acknowledgements`
  );
  return response.data.items;
};

export const supplierConfirmDelivery = async (payload: SupplierConfirmationPayload) => {
  const response = await apiClient.post<EvidenceAcknowledgement>("/supplier/confirm-delivery", payload);
  return response.data;
};

export const fetchHighRiskEntries = async () => {
  const response = await apiClient.get<HighRiskEntry[]>("/entries/high-risk");
  return response.data;
};

export const fetchEntryRisk = async (entryId: string) => {
  const response = await apiClient.get<EntryRisk>(`/entries/${entryId}/risk`);
  return response.data;
};

export const fetchDuplicateEvidenceEntries = async () => {
  const response = await apiClient.get<DuplicateEvidenceEntry[]>("/evidence/duplicates");
  return response.data;
};
