import { apiClient } from "./client";
import { Notification } from "../types/notification";
import { PaginatedResponse } from "../types/pagination";

export const fetchNotifications = async () => {
  const response = await apiClient.get<PaginatedResponse<Notification>>("/notifications");
  return response.data.items;
};

export const acknowledgeNotification = async (notificationId: string) => {
  const response = await apiClient.post<Notification>(`/notifications/${notificationId}/acknowledge`);
  return response.data;
};

export const disputeNotification = async (notificationId: string) => {
  const response = await apiClient.post<Notification>(`/notifications/${notificationId}/dispute`);
  return response.data;
};
