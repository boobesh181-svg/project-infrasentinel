export type AcknowledgementRole = "VERIFIER" | "AUDITOR" | "SUPPLIER";
export type AcknowledgementResponseType = "ACK" | "DISPUTE";

export type EvidenceAcknowledgement = {
  id: string;
  material_entry_id: string;
  user_id: string;
  role: AcknowledgementRole;
  response_type: AcknowledgementResponseType;
  comment?: string | null;
  timestamp: string;
};

export type SupplierConfirmationPayload = {
  entry_id: string;
  confirmation_status: "ACK" | "DISPUTE";
  comment?: string;
};

export type HighRiskEntry = {
  entry_id: string;
  project_id: string;
  material_name: string;
  status: string;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
  generated_at: string;
};

export type EntryRisk = {
  entry_id: string;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
  generated_at: string;
};

export type DuplicateEvidenceEntry = {
  entry_id: string;
  project_id: string;
  material_name: string;
  status: string;
  created_at: string;
};
