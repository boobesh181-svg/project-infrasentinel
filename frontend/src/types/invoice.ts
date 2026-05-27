export type InvoiceLink = {
  id: string;
  invoice_id: string;
  delivery_event_id: string;
  match_confidence?: number | null;
  match_reason?: string | null;
  matched_at: string;
};

export type InvoiceConfidence = {
  overall: number;
  fields: Record<string, number>;
};

export type SupplierInvoice = {
  id: string;
  organization_id: string;
  uploaded_by: string;
  supplier_name?: string | null;
  invoice_number?: string | null;
  material_type?: string | null;
  expected_quantity?: number | null;
  vehicle_number?: string | null;
  invoice_timestamp?: string | null;
  raw_text?: string | null;
  extraction_confidence: InvoiceConfidence;
  extraction_status: "EXTRACTED" | "NEEDS_REVIEW" | "CONFIRMED" | "FAILED";
  extraction_errors: string[];
  file_name: string;
  file_type: string;
  content_type: string;
  file_size: number;
  file_hash: string;
  storage_path: string;
  correction_notes?: string | null;
  corrected_by?: string | null;
  corrected_at?: string | null;
  uploaded_at: string;
  updated_at: string;
  delivery_links: InvoiceLink[];
};

export type SupplierInvoiceList = {
  total: number;
  items: SupplierInvoice[];
};

export type SupplierInvoiceUpdate = {
  supplier_name?: string | null;
  invoice_number?: string | null;
  material_type?: string | null;
  expected_quantity?: number | null;
  vehicle_number?: string | null;
  invoice_timestamp?: string | null;
  correction_notes?: string | null;
};
