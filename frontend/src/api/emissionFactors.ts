import { apiClient } from "./client";
import { EmissionFactor } from "../types/emissionFactor";

export const fetchEmissionFactors = async () => {
  const response = await apiClient.get<EmissionFactor[]>("/emission-factors");
  return response.data;
};
