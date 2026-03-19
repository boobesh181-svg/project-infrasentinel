import { apiClient } from "./client";
import { EmissionFactor } from "../types/emissionFactor";
import { PaginatedResponse } from "../types/pagination";

export const fetchEmissionFactors = async () => {
  const response = await apiClient.get<PaginatedResponse<EmissionFactor>>("/emission-factors");
  return response.data.items;
};
