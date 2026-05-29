import { apiClient } from "./client";

// Local scenario fallbacks (generated scenarios)
import verified_delivery from "../../../demo/seed_data/deliveries/verified_delivery.json";
import quantity_discrepancy from "../../../demo/seed_data/deliveries/quantity_discrepancy.json";
import incomplete_evidence from "../../../demo/seed_data/deliveries/incomplete_evidence.json";

export async function fetchSites() {
  const resp = await apiClient.get("/ops/sites");
  return resp.data;
}

export async function ingestEvent(payload: any) {
  const resp = await apiClient.post("/ops/ingest", payload);
  return resp.data;
}

export async function getDelivery(id: string) {
  try {
    const resp = await apiClient.get(`/ops/delivery/${id}`);
    return resp.data;
  } catch (err) {
    // fallback to local generated scenarios
    if (!id) throw err;
    if (id === "verified_delivery") return verified_delivery;
    if (id === "quantity_discrepancy") return quantity_discrepancy;
    if (id === "incomplete_evidence") return incomplete_evidence;
    // If id looks like a composite (e.g., date-index), try to return one of the scenarios by partial match
    if (id.includes("verified")) return verified_delivery;
    if (id.includes("quantity")) return quantity_discrepancy;
    if (id.includes("incomplete")) return incomplete_evidence;
    throw err;
  }
}

export async function listLocalDeliveries() {
  // Map scenario JSONs to a compact delivery row format used by the ledger/command center
  const scenarios: any[] = [verified_delivery, quantity_discrepancy, incomplete_evidence];
  return scenarios.map((s) => {
    const firstEv = (s.evidence && s.evidence[0]) || {};
    const invoice = (s.evidence || []).find((e: any) => e.type === 'invoice')?.invoice || s.invoice || {};
    const anpr = (s.evidence || []).find((e: any) => e.type === 'anpr')?.anpr || {};
    const wb = (s.evidence || []).find((e: any) => e.type === 'weighbridge')?.weighbridge || {};
    const videoCount = (s.evidence || []).filter((e: any) => e.fileName).length;
    const anomaly = s.report && s.report.anomalySeverity && s.report.anomalySeverity !== 'none';
    return {
      id: s.id,
      time: firstEv.timestamp || new Date().toISOString(),
      plate: anpr.plate || (s.report && s.report.metadata && s.report.metadata.vehicle) || 'UNKNOWN',
      supplier: invoice && invoice.supplier ? invoice.supplier : 'Unknown supplier',
      material: invoice && invoice.material ? invoice.material : 'Aggregate',
      state: s.report && s.report.anomalySeverity ? s.report.anomalySeverity.toUpperCase() : 'PROCESSING',
      tons: wb && wb.weight ? wb.weight : (invoice && invoice.declaredWeight) || 0,
      expected: (invoice && invoice.declaredWeight) || 0,
      confidence: s.report && s.report.confidenceBreakdown ? s.report.confidenceBreakdown.aggregate : 0.8,
      anomaly: anomaly,
      invoice: invoice && invoice.id ? invoice.id : (s.id + '-INV'),
      evidence: (s.evidence || []).map((e: any) => e.type || (e.fileName ? 'video' : 'evidence')),
      evidenceCount: (s.evidence || []).length,
      videoCount,
      anomalyCount: anomaly ? 1 : 0,
      site: firstEv.siteId || 'SITE-UNKNOWN'
    };
  });
}

export async function verifyDelivery(id: string, action: any) {
  const resp = await apiClient.post(`/ops/delivery/${id}/verify`, action);
  return resp.data;
}
