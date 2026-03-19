export type EmissionsByProject = {
  project_id: string;
  project_name: string;
  emissions: number;
};

export type EmissionsByMaterial = {
  material_name: string;
  emissions: number;
};

export type EmissionsByTime = {
  period_start: string;
  emissions: number;
};
