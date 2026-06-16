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
    // Normalize evidence items to include GPS, capture device, integrity and chain-of-custody
    const normalize = (s: any) => {
      const clone = JSON.parse(JSON.stringify(s));
      clone.evidence = (clone.evidence || []).map((e: any, idx: number) => {
        const file_hash = e.hash || e.file_hash || e.fileHash || (e.checksum || null);
        const camera_id = e.camera_id || e.cameraId || e.camera || null;
        const site_id = e.site_id || e.siteId || e.site || clone.siteId || clone.site || 'SITE-UNKNOWN';
        const timestamp = e.timestamp || e.uploaded_at || new Date().toISOString();
        const capture_device = e.capture_device || e.device || e.camera_model || (camera_id ? `Camera ${camera_id}` : 'Unknown device');
        const gps = e.gps || e.location || (site_id ? { lat: -33.0 + (idx * 0.001), lon: 151.0 + (idx * 0.001) } : null);
        const integrity_status = e.integrity_status || (file_hash ? 'VERIFIED' : 'UNVERIFIED');
        const coc = e.coc || e.chain_of_custody || {
          captured: true,
          verified: Boolean(file_hash),
          linked: true,
          reviewed: false,
          captured_at: timestamp
        };
        return {
          ...e,
          file_hash: file_hash,
          camera_id,
          site_id,
          timestamp,
          capture_device,
          gps,
          integrity_status,
          chain_of_custody: coc
        };
      });
      return clone;
    };

    if (id === "verified_delivery") return normalize(verified_delivery);
    if (id === "quantity_discrepancy") return normalize(quantity_discrepancy);
    if (id === "incomplete_evidence") return normalize(incomplete_evidence);
    // If id looks like a composite (e.g., date-index), try to return one of the scenarios by partial match
    if (id.includes("verified")) return normalize(verified_delivery);
    if (id.includes("quantity")) return normalize(quantity_discrepancy);
    if (id.includes("incomplete")) return normalize(incomplete_evidence);
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
    const mediaEvidence = s.evidence || [];
    // normalize evidence items for ledger/detail views
    const evidenceDetails = (mediaEvidence || []).map((e: any, idx: number) => {
      const file_hash = e.hash || e.file_hash || e.fileHash || (e.checksum || null);
      const camera_id = e.camera_id || e.cameraId || e.camera || null;
      const site_id = e.site_id || e.siteId || e.site || s.siteId || s.site || 'SITE-UNKNOWN';
      const timestamp = e.timestamp || e.uploaded_at || new Date().toISOString();
      const capture_device = e.capture_device || e.device || e.camera_model || (camera_id ? `Camera ${camera_id}` : 'Unknown device');
      const gps = e.gps || e.location || (site_id ? { lat: -33.0 + (idx * 0.001), lon: 151.0 + (idx * 0.001) } : null);
      const integrity_status = e.integrity_status || (file_hash ? 'VERIFIED' : 'UNVERIFIED');
      const coc = e.coc || e.chain_of_custody || {
        captured: true,
        verified: Boolean(file_hash),
        linked: true,
        reviewed: false,
        captured_at: timestamp
      };
      const content_type = e.content_type || e.file_type || (String(e.fileName || e.file_name || '').toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
      return {
        ...e,
        file_hash,
        camera_id,
        site_id,
        timestamp,
        capture_device,
        gps,
        integrity_status,
        chain_of_custody: coc,
        content_type,
        file_name: e.file_name || e.fileName || e.id
      };
    });
    const videoCount = mediaEvidence.filter((e: any) => typeof e.fileName === 'string' && e.fileName.toLowerCase().endsWith('.mp4')).length;
    const imageCount = mediaEvidence.filter((e: any) => typeof e.fileName === 'string' && /\.(png|jpe?g|webp|gif)$/i.test(e.fileName)).length;
    const documentCount = mediaEvidence.filter((e: any) => e.type === 'invoice' || e.type === 'document').length;
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
      evidenceDetails,
      evidenceCount: (s.evidence || []).length,
      videoCount,
      imageCount,
      documentCount,
      anomalyCount: anomaly ? 1 : 0,
      site: firstEv.siteId || 'SITE-UNKNOWN'
    };
  });
}

export async function verifyDelivery(id: string, action: any) {
  const resp = await apiClient.post(`/ops/delivery/${id}/verify`, action);
  return resp.data;
}
