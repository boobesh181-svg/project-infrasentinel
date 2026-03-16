import { apiClient } from "./client";
import { TokenResponse } from "../types/auth";

export const login = async (username: string, password: string) => {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  const response = await apiClient.post<TokenResponse>("/auth/login", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  return response.data;
};
