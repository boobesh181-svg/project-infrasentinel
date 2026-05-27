import { apiClient } from "./client";
import { SupplierInvoice, SupplierInvoiceList, SupplierInvoiceUpdate } from "../types/invoice";

export async function uploadInvoice(file: File): Promise<SupplierInvoice> {
  const form = new FormData();
  form.append("file", file);
  const resp = await apiClient.post("/invoices", form, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return resp.data;
}

export async function listInvoices(query?: string): Promise<SupplierInvoiceList> {
  const resp = await apiClient.get("/invoices", {
    params: query ? { query } : undefined
  });
  return resp.data;
}

export async function getInvoice(invoiceId: string): Promise<SupplierInvoice> {
  const resp = await apiClient.get(`/invoices/${invoiceId}`);
  return resp.data;
}

export async function updateInvoice(invoiceId: string, payload: SupplierInvoiceUpdate): Promise<SupplierInvoice> {
  const resp = await apiClient.patch(`/invoices/${invoiceId}`, payload);
  return resp.data;
}

export async function downloadInvoice(invoiceId: string): Promise<Blob> {
  const resp = await apiClient.get(`/invoices/${invoiceId}/download`, {
    responseType: "blob"
  });
  return resp.data;
}
