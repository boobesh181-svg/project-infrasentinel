const fs = require('fs');
const path = require('path');

// User-provided video paths (absolute)
const videos = [
  'c:/Users/boobesh/Downloads/7163093-uhd_3840_2160_24fps.mp4',
  'c:/Users/boobesh/Downloads/11596308-hd_1920_1080_30fps.mp4',
  'c:/Users/boobesh/Downloads/4760920-hd_1920_1080_24fps.mp4',
  'c:/Users/boobesh/Downloads/3365496-uhd_3840_2160_30fps.mp4',
  'c:/Users/boobesh/Downloads/3818441-uhd_1920_1440_30fps.mp4',
  'c:/Users/boobesh/Downloads/14346212-uhd_2160_3840_30fps.mp4',
  'c:/Users/boobesh/Downloads/15969748_2160_3840_30fps.mp4',
  'c:/Users/boobesh/Downloads/15233119_2160_3840_30fps.mp4',
  'c:/Users/boobesh/Downloads/18370431-uhd_3840_2160_30fps.mp4',
  'c:/Users/boobesh/Downloads/15233172_2160_3840_30fps.mp4',
  'c:/Users/boobesh/Downloads/15233119_2160_3840_30fps (1).mp4'
];

function makeVideoEvidence(file, opts) {
  const exists = fs.existsSync(file);
  const stat = exists ? fs.statSync(file) : null;
  return {
    id: opts.id,
    type: opts.type,
    timestamp: opts.timestamp,
    siteId: opts.siteId,
    cameraId: opts.cameraId,
    cameraAngle: opts.cameraAngle,
    weather: opts.weather || 'Clear',
    lighting: opts.lighting || 'Daylight',
    operator: opts.operator || 'auto',
    fileName: file,
    fileSize: stat ? stat.size : null,
    hash: exists ? `sha1:${require('crypto').createHash('sha1').update(file).digest('hex')}` : `sha1:missing-${path.basename(file)}`,
    confidence: opts.confidence || 0.9
  };
}

function writeScenario(dir, name, obj) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(obj, null, 2));
}

// simple operational report generator (lightweight copy)
function clamp(v) { if (!isFinite(v) || isNaN(v)) return 0; return Math.max(0, Math.min(1, v)); }
function safeNum(v) { if (typeof v === 'number' && isFinite(v)) return v; if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return isFinite(n) ? n : null; } return null; }
function generateOperationalReport(evidence) {
  const cfg = { absoluteTolerance: 0.5, relativeTolerance: 0.03 };
  let anprBest, weighBest, invoiceBest;
  for (const e of evidence || []) {
    if (e.anpr && (!anprBest || (e.anpr.confidence || 0) > (anprBest.confidence || 0))) anprBest = e.anpr;
    if (e.weighbridge && (!weighBest || (e.weighbridge.confidence || 0) > (weighBest.confidence || 0))) weighBest = e.weighbridge;
    if (e.invoice && (!invoiceBest || (e.invoice.trusted || 0) > (invoiceBest.trusted || 0))) invoiceBest = e.invoice;
  }
  const deliveredWeight = safeNum(weighBest && weighBest.weight);
  const declaredWeight = safeNum(invoiceBest && invoiceBest.declaredWeight);
  const unit = (weighBest && weighBest.unit) || (invoiceBest && invoiceBest.unit) || 'units';
  const vehicle = anprBest && anprBest.plate ? anprBest.plate : null;
  let discrepancy = null;
  if (declaredWeight !== null && deliveredWeight !== null) discrepancy = Number((declaredWeight - deliveredWeight).toFixed(3));
  const anprConf = clamp((anprBest && anprBest.confidence) || 0);
  const weighConf = clamp((weighBest && (typeof weighBest.confidence === 'number' ? weighBest.confidence : 0.95)) || 0.95);
  const invoiceConf = clamp((invoiceBest && (typeof invoiceBest.trusted === 'number' ? invoiceBest.trusted : 0.85)) || 0.85);
  const aggregate = clamp(0.4 * anprConf + 0.5 * weighConf + 0.1 * invoiceConf);
  let severity = 'none';
  if (discrepancy === null) severity = 'minor'; else {
    const abs = Math.abs(discrepancy);
    const rel = declaredWeight ? Math.abs(discrepancy) / Math.max(1, Math.abs(declaredWeight)) : 0;
    if (abs <= cfg.absoluteTolerance || rel <= cfg.relativeTolerance) severity = 'none'; else if (abs <= 1.0) severity = 'minor'; else if (abs <= 2.5) severity = 'moderate'; else if (abs <= 5.0) severity = 'major'; else severity = 'critical';
  }
  const discrepancyExplanation = (function () {
    if (discrepancy === null) return 'verification incomplete: missing weighbridge or invoice evidence.';
    const sign = discrepancy > 0 ? 'less than' : 'greater than';
    const abs = Math.abs(discrepancy);
    return `Delivered weight is ${abs} ${unit} ${sign} declared invoice weight (${declaredWeight} ${unit}).`;
  })();
  const possibleCauses = [];
  if (discrepancy === null) {
    possibleCauses.push('Partial evidence chain — missing measurements or documents.');
  } else {
    if (discrepancy > 0) { possibleCauses.push('Partial unloading prior to weighbridge.'); possibleCauses.push('Invoice overstatement.'); }
    else { possibleCauses.push('Weighbridge over-reading or calibration issue.'); }
  }
  const escalation = [];
  if (severity === 'none') escalation.push('monitor'); else if (severity === 'minor') escalation.push('review'); else if (severity === 'moderate') escalation.push('escalate'); else escalation.push('open_incident');
  const supportingEvidence = [];
  if (anprBest && anprConf >= 0.9) supportingEvidence.push(`ANPR matched vehicle plate with ${(anprConf * 100).toFixed(0)}% confidence.`);
  if (weighBest && weighConf >= 0.9) supportingEvidence.push(`Weighbridge recorded ${deliveredWeight} ${unit} with ${(weighConf * 100).toFixed(0)}% confidence.`);
  if (invoiceBest && invoiceConf >= 0.9) supportingEvidence.push(`Invoice trusted ${(invoiceConf * 100).toFixed(0)}%.`);
  const conflictingEvidence = [];
  if (discrepancy !== null && discrepancy > cfg.absoluteTolerance) conflictingEvidence.push(`Delivered weight (${deliveredWeight} ${unit}) differs from invoice (${declaredWeight} ${unit}).`);
  const evidenceGaps = [];
  if (!anprBest) evidenceGaps.push('No ANPR data.');
  if (!weighBest) evidenceGaps.push('No weighbridge data.');
  if (!invoiceBest) evidenceGaps.push('No invoice data.');
  return {
    operationalSummary: `${vehicle || '(unknown)'} delivery verification.`,
    discrepancyExplanation,
    anomalySeverity: severity,
    confidenceBreakdown: { anpr: anprConf, weighbridge: weighConf, invoice: invoiceConf, aggregate },
    possibleCauses,
    escalationRecommendation: escalation,
    supportingEvidence,
    conflictingEvidence,
    evidenceGaps,
    confidenceRationale: `ANPR ${Math.round(anprConf * 100)}%; Weighbridge ${Math.round(weighConf * 100)}%; Invoice ${Math.round(invoiceConf * 100)}%` ,
    eventTimeline: [],
    finding: '',
    riskAssessment: { operational: 'low', financial: 'low', verificationConfidence: Math.round(aggregate * 100) },
    escalationDecision: { decision: escalation[0], justification: 'See recommendations.' },
    metadata: { vehicle, invoiceId: invoiceBest && invoiceBest.id ? invoiceBest.id : null, deliveredWeight: deliveredWeight === null ? null : deliveredWeight, declaredWeight: declaredWeight === null ? null : declaredWeight, discrepancy: discrepancy === null ? null : discrepancy, unit, evidenceCount: (evidence || []).length }
  };
}

// Scenario assignments
const baseTime = new Date('2026-05-27T08:12:00Z');
function t(offsetMin) { return new Date(baseTime.getTime() + offsetMin * 60000).toISOString(); }

const scenarios = [];

// Scenario 1: Verified Delivery
scenarios.push({
  id: 'verified_delivery',
  label: 'Verified Delivery',
  invoice: { id: 'INV-1000', declaredWeight: 16.4, unit: 'T', trusted: 0.95 },
  evidence: [
    makeVideoEvidence(videos[0], { id: 'gate_entry_1', type: 'truck-arrival', timestamp: t(0), siteId: 'SITE-A01', cameraId: 'GATE-CAM-02', cameraAngle: 'wide', confidence: 0.95 }),
    makeVideoEvidence(videos[1], { id: 'site_entry_1', type: 'site-entry', timestamp: t(2), siteId: 'SITE-A01', cameraId: 'SITE-CAM-01', cameraAngle: 'front', confidence: 0.94 }),
    { id: 'anpr_1', type: 'anpr', timestamp: t(3), siteId: 'SITE-A01', anpr: { plate: 'TN-22-AB-4821', confidence: 0.96 } },
    { id: 'wb_1', type: 'weighbridge', timestamp: t(6), siteId: 'SITE-A01', weighbridge: { weight: 16.4, unit: 'T', confidence: 0.98 } },
    makeVideoEvidence(videos[3], { id: 'unload_1', type: 'unloading', timestamp: t(8), siteId: 'SITE-A01', cameraId: 'UNLOAD-CAM-01', cameraAngle: 'side', confidence: 0.95 }),
  ]
});

// Scenario 2: Quantity Discrepancy
scenarios.push({
  id: 'quantity_discrepancy',
  label: 'Quantity Discrepancy',
  invoice: { id: 'INV-2000', declaredWeight: 18.0, unit: 'T', trusted: 0.93 },
  evidence: [
    makeVideoEvidence(videos[6], { id: 'gate_entry_2', type: 'truck-arrival', timestamp: t(10), siteId: 'SITE-B02', cameraId: 'GATE-CAM-01', cameraAngle: 'wide', confidence: 0.9 }),
    { id: 'anpr_2', type: 'anpr', timestamp: t(12), siteId: 'SITE-B02', anpr: { plate: 'TN-55-XY-100', confidence: 0.92 } },
    { id: 'wb_2', type: 'weighbridge', timestamp: t(14), siteId: 'SITE-B02', weighbridge: { weight: 16.4, unit: 'T', confidence: 0.96 } },
    makeVideoEvidence(videos[8], { id: 'unload_2', type: 'unloading', timestamp: t(16), siteId: 'SITE-B02', cameraId: 'UNLOAD-CAM-02', cameraAngle: 'rear', confidence: 0.9 }),
  ]
});

// Scenario 3: Incomplete Evidence Chain
scenarios.push({
  id: 'incomplete_evidence',
  label: 'Incomplete Evidence Chain',
  invoice: { id: 'INV-3000', declaredWeight: 12.0, unit: 'T', trusted: 0.9 },
  evidence: [
    makeVideoEvidence(videos[10], { id: 'gate_entry_3', type: 'truck-arrival', timestamp: t(20), siteId: 'SITE-C03', cameraId: 'GATE-CAM-03', cameraAngle: 'wide', confidence: 0.85 }),
    { id: 'anpr_3', type: 'anpr', timestamp: t(22), siteId: 'SITE-C03', anpr: { plate: 'TN-00-XX-000', confidence: 0.7 } },
    // missing weighbridge and unloading intentionally
  ]
});

// Write scenario JSON files under demo/seed_data/deliveries
const outDir = path.join(__dirname, '..', 'demo', 'seed_data', 'deliveries');
for (const s of scenarios) {
  const evidenceWithInvoice = (s.evidence || []).slice();
  evidenceWithInvoice.push({ id: 'inv', type: 'invoice', timestamp: t(1), siteId: s.evidence && s.evidence[0] ? s.evidence[0].siteId : 'SITE-UNKNOWN', invoice: s.invoice });
  const report = generateOperationalReport(evidenceWithInvoice);
  const obj = { id: s.id, label: s.label, evidence: evidenceWithInvoice, report };
  writeScenario(outDir, s.id, obj);
  // also write a copy to tools/ova_reports for quick access
  writeScenario(path.join(__dirname, 'ova_reports'), s.id, obj);
  console.log('Wrote scenario', s.id);
}

console.log('All scenarios created.');
