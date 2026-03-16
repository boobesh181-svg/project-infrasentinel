export type AuditLog = {
  id: string;
  performed_by_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  previous_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
  timestamp: string;
};
