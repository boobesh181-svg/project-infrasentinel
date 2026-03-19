export type MaterialStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "APPROVED" | "LOCKED";

export type MaterialEntry = {
  id: string;
  project_id: string;
  material_name: string;
  quantity: number;
  supplier_name?: string | null;
  supplier_email?: string | null;
  factor_version_snapshot: number;
  factor_value_snapshot: number;
  factor_unit_snapshot: string;
  factor_source_snapshot: string;
  calculated_emission: number;
  status: MaterialStatus;
  created_by_id: string;
  verified_by_id?: string | null;
  approved_by_id?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  locked_at?: string | null;
  audit_required: boolean;
  temporal_anomaly: boolean;
  bim_discrepancy_score?: number | null;
  bim_validation_status?: string | null;
  created_at: string;
};

export type MaterialEntryCreate = {
  project_id: string;
  material_name: string;
  quantity: number;
  supplier_name?: string;
  supplier_email?: string;
  factor_version_snapshot: number;
  factor_value_snapshot: number;
  factor_unit_snapshot: string;
  factor_source_snapshot: string;
};
