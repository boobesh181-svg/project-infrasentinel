import { apiClient } from "./client";

export async function fetchSites() {
  const resp = await apiClient.get("/ops/sites");
  return resp.data;
}

export async function ingestEvent(payload: any) {
  const resp = await apiClient.post("/ops/ingest", payload);
  return resp.data;
}

export async function getDelivery(id: string) {
  const resp = await apiClient.get(`/ops/delivery/${id}`);
  return resp.data;
}

export async function verifyDelivery(id: string, action: any) {
  const resp = await apiClient.post(`/ops/delivery/${id}/verify`, action);
  return resp.data;
}
