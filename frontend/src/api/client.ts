import axios from "axios";
import { getStoredToken } from "../hooks/useAuth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem("infrasentinel_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    if (status === 403) {
      error.message = "You do not have access to this resource.";
    } else if (status === 404) {
      error.message = "The requested item was not found.";
    } else if (status === 409) {
      error.message = "The request conflicts with the current workflow state.";
    }
    return Promise.reject(error);
  }
);
