export type EmissionFactor = {
  id: string;
  material_name: string;
  factor_value: number;
  unit: string;
  source: string;
  standard_name: string;
  region: string;
  source_document_url: string;
  methodology_reference: string;
  version: number;
  valid_from: string;
  valid_to?: string | null;
  is_active: boolean;
  created_at: string;
};
