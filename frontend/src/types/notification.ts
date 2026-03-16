export type ResponseType = "NONE" | "ACKNOWLEDGED" | "DISPUTED";

export type Notification = {
  id: string;
  entity_type: string;
  entity_id: string;
  notified_user_id: string;
  response_type: ResponseType;
  response_deadline: string;
  notified_at: string;
  responded_at?: string | null;
};
