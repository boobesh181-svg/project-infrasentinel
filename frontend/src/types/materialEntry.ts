export type MaterialStatus = "DRAFT" | "SUBMITTED" | "VERIFIED" | "APPROVED" | "LOCKED";

export type MaterialEntry = {
  id: string;
  project_id: string;
  material_name: string;
  quantity: number;
  factor_version_snapshot: number;
  factor_value_snapshot: number;
  factor_unit_snapshot: string;
  factor_source_snapshot: string;
  calculated_emission: number;
  status: MaterialStatus;
  created_by_id: string;
  verified_by_id?: string | null;
  approved_by_id?: string | null;
  locked_at?: string | null;
  created_at: string;
};

export type MaterialEntryCreate = {
  project_id: string;
  material_name: string;
  quantity: number;
  factor_version_snapshot: number;
  factor_value_snapshot: number;
  factor_unit_snapshot: string;
  factor_source_snapshot: string;
};
