export type Project = {
  id: string;
  organization_id: string;
  created_by_id: string;
  name: string;
  location: string;
  reporting_period_start: string;
  reporting_period_end: string;
  created_at: string;
};

export type ProjectCreate = {
  name: string;
  location: string;
  reporting_period_start: string;
  reporting_period_end: string;
};
