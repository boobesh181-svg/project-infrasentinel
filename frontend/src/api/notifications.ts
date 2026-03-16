import { apiClient } from "./client";
import { Notification } from "../types/notification";

export const fetchNotifications = async () => {
  const response = await apiClient.get<Notification[]>("/notifications");
  return response.data;
};

export const acknowledgeNotification = async (notificationId: string) => {
  const response = await apiClient.post<Notification>(`/notifications/${notificationId}/acknowledge`);
  return response.data;
};

export const disputeNotification = async (notificationId: string) => {
  const response = await apiClient.post<Notification>(`/notifications/${notificationId}/dispute`);
  return response.data;
};
