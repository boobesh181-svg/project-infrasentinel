export type WeighbridgeEvent = {
  id: string;
  organization_id: string;
  delivery_event_id: string;
  invoice_id?: string | null;
  gross_weight: number;
  tare_weight?: number | null;
  net_weight?: number | null;
  unit: string;
  gross_captured_at: string;
  tare_captured_at?: string | null;
  expected_quantity?: number | null;
  mismatch_percent?: number | null;
  mismatch_threshold: number;
  anomaly_flags: string[];
  status: "GROSS_CAPTURED" | "TARE_CAPTURED" | "VERIFIED" | "MISMATCH";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WeighbridgeCreate = {
  delivery_event_id: string;
  invoice_id?: string | null;
  gross_weight: number;
  unit?: string;
};

export type WeighbridgeTare = {
  tare_weight: number;
  mismatch_threshold?: number;
};
