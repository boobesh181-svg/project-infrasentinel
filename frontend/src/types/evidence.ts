export type Evidence = {
  id: string;
  material_entry_id: string;
  file_name: string;
  file_type: string;
  content_type: string;
  file_size: number;
  file_hash: string;
  evidence_type: string;
  duplicate_flag: boolean;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
};
