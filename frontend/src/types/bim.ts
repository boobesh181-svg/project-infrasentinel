export type BIMDiscrepancy = {
  project_id: string;
  project_name: string;
  material_type: string;
  estimated_quantity: number;
  reported_quantity: number;
  discrepancy_ratio: number;
};

export type BIMModelUpload = {
  id: string;
  project_id: string;
  file_path: string;
  file_format: "IFC" | "RVT" | "GLTF";
  uploaded_by: string;
  uploaded_at: string;
};

export type BIMUploadResult = {
  model_id: string;
};

export type ProjectBIMEstimate = {
  material: string;
  estimated: number;
  reported: number;
  discrepancy: number;
  status: "OK" | "WARNING" | "HIGH";
};

export type ProjectBIMDiscrepancy = {
  material: string;
  estimated: number;
  reported: number;
  discrepancy: number;
  status: "OK" | "WARNING" | "HIGH";
};

export type AntiCorruptionSummary = {
  high_risk_entries: number;
  projects_with_bim_discrepancies: number;
  entries_pending_supplier_confirmation: number;
};
