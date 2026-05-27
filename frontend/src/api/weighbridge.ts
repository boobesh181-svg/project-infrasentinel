import { apiClient } from "./client";
import { WeighbridgeCreate, WeighbridgeEvent, WeighbridgeTare } from "../types/weighbridge";

export async function captureGross(payload: WeighbridgeCreate): Promise<WeighbridgeEvent> {
  const resp = await apiClient.post("/weighbridge/events", payload);
  return resp.data;
}

export async function captureTare(eventId: string, payload: WeighbridgeTare): Promise<WeighbridgeEvent> {
  const resp = await apiClient.post(`/weighbridge/events/${eventId}/tare`, payload);
  return resp.data;
}

export async function getWeighbridgeEvent(eventId: string): Promise<WeighbridgeEvent> {
  const resp = await apiClient.get(`/weighbridge/events/${eventId}`);
  return resp.data;
}

export async function getWeighbridgeByDelivery(deliveryId: string): Promise<WeighbridgeEvent | null> {
  const resp = await apiClient.get(`/weighbridge/events/delivery/${deliveryId}`);
  return resp.data;
}
