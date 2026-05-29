// Infrastructure Investigation Analyst (project-infra)
export type ANPREntry = { plate?: string; confidence?: number };
export type WeighbridgeEntry = { weight?: number; unit?: string; confidence?: number };
export type InvoiceEntry = { id?: string; declaredWeight?: number; unit?: string; trusted?: number };
export type EvidenceEntry = {
  id?: string;
  type?: string;
  timestamp?: string;
  site?: string;
  camera?: string;
  fileName?: string;
  fileHash?: string;
  anpr?: ANPREntry;
  weighbridge?: WeighbridgeEntry;
  invoice?: InvoiceEntry;
  note?: string;
};

export type OperationalReport = {
  operationalSummary: string;
  discrepancyExplanation: string;
  anomalySeverity: 'none' | 'minor' | 'moderate' | 'major' | 'critical';
  confidenceBreakdown: { anpr: number; weighbridge: number; invoice: number; aggregate: number };
  possibleCauses: string[];
  escalationRecommendation: string[];
  
  // Investigation Analyst additions
  supportingEvidence: string[];
  conflictingEvidence: string[];
  evidenceGaps: string[];
  confidenceRationale: string;
  eventTimeline: Array<{ timestamp?: string; event: string }>;
  finding: string;
  riskAssessment: {
    operational: 'low' | 'medium' | 'high' | 'critical';
    financial: 'low' | 'medium' | 'high' | 'critical';
    verificationConfidence: number;
  };
  escalationDecision: {
    decision: 'monitor' | 'review' | 'escalate' | 'open_incident';
    justification: string;
  };
  supportingEvidenceDetails?: Array<{ id?: string; type?: string; timestamp?: string; site?: string; camera?: string; hash?: string; confidence?: number; fileName?: string; note?: string }>;
  conflictingEvidenceDetails?: Array<{ id?: string; type?: string; timestamp?: string; site?: string; camera?: string; hash?: string; confidence?: number; fileName?: string; note?: string }>;
  chainOfEvidence?: Array<{ step: string; evidenceId?: string; timestamp?: string }>;
  
  metadata: { vehicle?: string | null; invoiceId?: string | null; deliveredWeight?: number | null; declaredWeight?: number | null; discrepancy?: number | null; unit?: string | null; evidenceCount: number };
};

const clamp = (v: number) => {
  if (!isFinite(v) || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
};
function safeNum(v: any): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}

function normalizeInvoiceId(id: any): string {
  if (id === null || id === undefined) return '';
  try {
    return String(id).toLowerCase().replace(/[^a-z0-9]/g, '');
  } catch (e) {
    return String(id);
  }
}

function riskLevel(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  if (severity === 'none') return 'low';
  if (severity === 'minor') return 'low';
  if (severity === 'moderate') return 'medium';
  if (severity === 'major') return 'high';
  if (severity === 'critical') return 'critical';
  return 'low';
}

export function generateOperationalReport(evidence: EvidenceEntry[], ledger?: any, config?: { absoluteTolerance?: number; relativeTolerance?: number }): OperationalReport {
  const cfg = { absoluteTolerance: 0.5, relativeTolerance: 0.03, ...config };
  const report: Partial<OperationalReport> = {};
  let anprBest: ANPREntry | undefined;
  let weighBest: WeighbridgeEntry | undefined;
  let invoiceBest: InvoiceEntry | undefined;
  for (const e of evidence) {
    if (e.anpr && (!anprBest || (e.anpr.confidence || 0) > (anprBest.confidence || 0))) anprBest = e.anpr;
    if (e.weighbridge && (!weighBest || (e.weighbridge.confidence || 0) > (weighBest.confidence || 0))) weighBest = e.weighbridge;
    if (e.invoice && (!invoiceBest || (e.invoice.trusted || 0) > (invoiceBest.trusted || 0))) invoiceBest = e.invoice;
  }
  const deliveredWeight = safeNum(weighBest?.weight) ?? null;
  const declaredWeight = safeNum(invoiceBest?.declaredWeight) ?? null;
  const unit = weighBest?.unit || invoiceBest?.unit || 'units';
  const vehicle = anprBest?.plate ?? null;
  let discrepancy: number | null = null;
  if (declaredWeight !== null && deliveredWeight !== null) discrepancy = Number((declaredWeight - deliveredWeight).toFixed(3));
  const anprConf = clamp(anprBest?.confidence ?? 0);
  const weighConf = clamp(weighBest?.confidence ?? 0.95);
  const invoiceConf = clamp(invoiceBest?.trusted ?? 0.85);
  const aggregate = clamp(0.4 * anprConf + 0.5 * weighConf + 0.1 * invoiceConf);
  let severity: OperationalReport['anomalySeverity'] = 'none';
  if (discrepancy === null) severity = 'minor'; else {
    const abs = Math.abs(discrepancy);
    const rel = declaredWeight ? Math.abs(discrepancy) / Math.max(1, Math.abs(declaredWeight)) : 0;
    if (abs <= cfg.absoluteTolerance || rel <= cfg.relativeTolerance) severity = 'none'; else if (abs <= 1.0) severity = 'minor'; else if (abs <= 2.5) severity = 'moderate'; else if (abs <= 5.0) severity = 'major'; else severity = 'critical';
  }
  const discrepancyExplanation = (() => {
    if (discrepancy === null) return 'Unable to compute a weight discrepancy due to missing weighbridge or invoice data.';
    const sign = discrepancy > 0 ? 'less than' : 'greater than';
    const abs = Math.abs(discrepancy);
    return `Delivered weight is ${abs} ${unit} ${sign} declared invoice weight (${declaredWeight} ${unit}).`;
  })();
  const possibleCauses: string[] = [];
  if (discrepancy === null) {
    possibleCauses.push('Camera outage or blurred frames preventing evidence capture.');
    possibleCauses.push('Upload or ingestion failure for evidence files.');
    possibleCauses.push('Evidence retention or purge configuration removed expected files.');
    possibleCauses.push('Synchronization delay between systems (weighbridge / camera uploads).');
    possibleCauses.push('Operator omission: manual records not yet attached.');
    possibleCauses.push('Hardware malfunction at capture point (camera/scale).');
  } else {
    if (discrepancy !== null && discrepancy > 0) { possibleCauses.push('Partial unloading prior to weighbridge (delivered < invoiced).'); possibleCauses.push('Invoice overstatement or clerical error on declared weight.'); }
    else if (discrepancy !== null && discrepancy < 0) { possibleCauses.push('Weighbridge over-reporting or calibration issue (delivered > invoiced).'); possibleCauses.push('Invoice under-reporting or unit mismatch.'); }
  }
  if (anprConf < 0.7) possibleCauses.push('ANPR recognition confidence is low — vehicle identity may be uncertain.');
  if (weighConf < 0.8) possibleCauses.push('Weighbridge reading confidence is low — sensor or integration issue.');
  const escalation: string[] = [];
  if (severity === 'none') escalation.push('No immediate escalation required; record findings to delivery ledger.'); else { escalation.push('Operator review recommended: verify full chain-of-custody and inspect physical site logs.'); if (anprConf < 0.8) escalation.push('Confirm vehicle identity with manual photo/ID checks.'); if (weighConf < 0.9) escalation.push('Re-check weighbridge calibration logs and cross-validate with secondary scale if available.'); escalation.push('If discrepancy persists, open formal incident ticket and notify operations manager.'); }
  const operationalSummary = (() => {
    const vehicleStr = vehicle ? `Vehicle ${vehicle}` : 'Vehicle (unknown)';
    if (discrepancy === null) return `${vehicleStr}: incomplete data — missing invoice or weighbridge record.`;
    const direction = discrepancy > 0 ? 'delivered less than invoice' : 'delivered more than invoice';
    return `${vehicleStr} ${direction} by ${Math.abs(discrepancy)} ${unit} (declared ${declaredWeight} ${unit}, delivered ${deliveredWeight} ${unit}).`;
  })();
  // === INVESTIGATION ANALYST ADDITIONS ===

  // Supporting evidence
  const supportingEvidence: string[] = [];
  if (anprBest && anprConf >= 0.9) supportingEvidence.push(`ANPR matched vehicle plate with ${(anprConf * 100).toFixed(0)}% confidence.`);
  if (weighBest && weighConf >= 0.9) supportingEvidence.push(`Weighbridge recorded ${deliveredWeight} ${unit} with ${(weighConf * 100).toFixed(0)}% confidence.`);
  if (invoiceBest && invoiceConf >= 0.9) supportingEvidence.push(`Invoice OCR/document trust score ${(invoiceConf * 100).toFixed(0)}%.`);
  if (discrepancy === null && (anprBest || weighBest || invoiceBest)) supportingEvidence.push(`Partial evidence chain established (${evidence.length} evidence item(s) captured).`);
  if (discrepancy !== null && Math.abs(discrepancy) <= cfg.absoluteTolerance) supportingEvidence.push(`Discrepancy within configured tolerance (± ${cfg.absoluteTolerance} ${unit}).`);

  // Conflicting evidence
  const conflictingEvidence: string[] = [];
  if (discrepancy !== null && discrepancy > cfg.absoluteTolerance) conflictingEvidence.push(`Delivered weight (${deliveredWeight} ${unit}) differs from invoice (${declaredWeight} ${unit}).`);
  if (anprConf < 0.8) conflictingEvidence.push(`ANPR confidence low (${(anprConf * 100).toFixed(0)}%) — vehicle identity uncertain.`);
  if (weighConf < 0.8) conflictingEvidence.push(`Weighbridge confidence low (${(weighConf * 100).toFixed(0)}%) — sensor reading reliability questionable.`);
  if (anprBest && invoiceBest && vehicle !== (invoiceBest.id || '')) conflictingEvidence.push(`Vehicle plate does not match expected invoice identifier.`);

  // Evidence gaps
  const evidenceGaps: string[] = [];
  if (!anprBest) evidenceGaps.push('No ANPR/vehicle identification data available.');
  if (!weighBest) evidenceGaps.push('No weighbridge/scale measurement data available.');
  if (!invoiceBest) evidenceGaps.push('No invoice/declared weight data available.');
  if (!evidence.find(e => e.fileName && e.fileName.toLowerCase().includes('unload'))) evidenceGaps.push('No unloading/offloading footage captured.');
  if (!evidence.find(e => e.type === 'operator_log')) evidenceGaps.push('No operator log or manual verification record.');
  if (!evidence.find(e => e.type === 'tare')) evidenceGaps.push('No tare weight or empty weight record.');

  // Confidence rationale
  const confidenceRationale = (() => {
    const parts: string[] = [];
    if (anprConf >= 0.9) parts.push(`ANPR high (${(anprConf * 100).toFixed(0)}%)`);
    else if (anprConf >= 0.7) parts.push(`ANPR moderate (${(anprConf * 100).toFixed(0)}%)`);
    else if (anprConf > 0) parts.push(`ANPR low (${(anprConf * 100).toFixed(0)}%)`);
    else parts.push('ANPR unavailable');

    if (weighConf >= 0.9) parts.push(`weighbridge high (${(weighConf * 100).toFixed(0)}%)`);
    else if (weighConf >= 0.8) parts.push(`weighbridge moderate (${(weighConf * 100).toFixed(0)}%)`);
    else parts.push(`weighbridge uncertain (${(weighConf * 100).toFixed(0)}%)`);

    if (invoiceConf >= 0.9) parts.push(`invoice trusted (${(invoiceConf * 100).toFixed(0)}%)`);
    else parts.push(`invoice moderate trust (${(invoiceConf * 100).toFixed(0)}%)`);

    return `Weighted by source importance: ${parts.join('; ')}. Aggregate confidence: ${(aggregate * 100).toFixed(0)}%.`;
  })();

  // Event timeline
  const eventTimeline: Array<{ timestamp?: string; event: string }> = [];
  if (invoiceBest) eventTimeline.push({ event: 'Invoice issued and uploaded to system.' });
  if (anprBest) eventTimeline.push({ event: `Vehicle ${vehicle || '(unidentified)'} entered site and captured by ANPR.` });
  if (weighBest) eventTimeline.push({ event: `Gross weight recorded: ${deliveredWeight} ${unit}.` });
  eventTimeline.push({ event: 'Material unloading and offloading executed.' });
  eventTimeline.push({ event: 'Tare weight recorded (if applicable).' });
  if (declaredWeight !== null && deliveredWeight !== null) {
    eventTimeline.push({ event: `Quantity comparison executed: declared ${declaredWeight} ${unit}, delivered ${deliveredWeight} ${unit}.` });
  }
  eventTimeline.push({ event: 'Verification report generated.' });

  // --- Structured evidence attribution ---
  const supportingDetails: OperationalReport['supportingEvidenceDetails'] = [];
  const conflictingDetails: OperationalReport['conflictingEvidenceDetails'] = [];
  // helper to extract evidence artifact info
  const extract = (e: EvidenceEntry) => ({ id: e.id, type: e.type || (e.fileName && String(e.fileName).toLowerCase().includes('.mp4') ? 'video' : e.type), timestamp: e.timestamp, site: e.site, camera: e.camera, hash: e.fileHash, confidence: (e.anpr && e.anpr.confidence) || (e.weighbridge && e.weighbridge.confidence) || (e.invoice && e.invoice.trusted) || undefined, fileName: e.fileName, note: e.note });

  for (const ev of evidence) {
    const art = extract(ev);
    if (ev.weighbridge) {
      supportingDetails.push({ ...art, note: `weighbridge:${ev.weighbridge.weight}${ev.weighbridge.unit ? ' ' + ev.weighbridge.unit : ''}` });
    }
    if (ev.anpr) {
      supportingDetails.push({ ...art, note: `anpr:plate=${ev.anpr.plate}` });
    }
    if (ev.invoice) {
      supportingDetails.push({ ...art, note: `invoice:${ev.invoice.id || ''}` });
    }
    // video or image evidence that can support timing/visual confirmation
    if (ev.fileName && (String(ev.type || '').toLowerCase().includes('truck') || String(ev.type || '').toLowerCase().includes('unload') || String(ev.fileName).toLowerCase().endsWith('.mp4'))) {
      supportingDetails.push({ ...art, note: `media:${ev.type || 'video/image'}` });
    }
  }

  // Conflicting evidence: invoice vs weighbridge when discrepancy exists
  if (discrepancy !== null) {
    const wbEv = evidence.find((e) => !!e.weighbridge);
    const invEv = evidence.find((e) => !!e.invoice);
    if (wbEv && invEv) {
      conflictingDetails.push(extract(invEv));
      conflictingDetails.push(extract(wbEv));
    }
  }

  // Build chronological chain of evidence by timestamp
  const chain: OperationalReport['chainOfEvidence'] = [];
  const byTime = [...evidence].slice().sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });
  for (const ev of byTime) {
    const label = ev.type || (ev.fileName && ev.fileName.toLowerCase().includes('arrival') ? 'Truck Arrival' : ev.anpr ? 'ANPR' : ev.weighbridge ? 'Weighbridge' : ev.invoice ? 'Invoice' : 'Evidence');
    chain.push({ step: label, evidenceId: ev.id, timestamp: ev.timestamp });
  }

  // Finding (investigation narrative)
  const finding = (() => {
    let narrative = '';
    if (discrepancy === null) {
      const supportIds = supportingDetails.map(s => s.id).filter(Boolean).slice(0,5).join(', ') || 'none';
      narrative = `Delivery verification incomplete. ${evidence.length} evidence item(s) captured. ${evidenceGaps.length} critical evidence gap(s) identified. Supporting evidence: ${supportIds}. Recommend collecting missing data before final verification.`;
    } else {
      const absDisc = Math.abs(discrepancy);
      const percDisc = declaredWeight ? ((absDisc / Math.max(1, Math.abs(declaredWeight))) * 100).toFixed(1) : 'N/A';
      const direction = discrepancy > 0 ? 'less' : 'more';
      const supportIds = supportingDetails.map(s => s.id).filter(Boolean).slice(0,5).join(', ') || 'none';
      const conflictIds = conflictingDetails.map(s => s.id).filter(Boolean).slice(0,5).join(', ') || 'none';
      narrative = `Delivery verification detected a ${severity.toUpperCase()} severity discrepancy: ${absDisc} ${unit} ${direction} than invoice (${percDisc}% variance). Vehicle ${vehicle || '(unknown)'} delivered ${deliveredWeight} ${unit} versus declared ${declaredWeight} ${unit}. Aggregate confidence in this finding: ${(aggregate * 100).toFixed(0)}%. Supporting evidence: ${supportIds}. Conflicting evidence: ${conflictIds}.`;
    }
    return narrative;
  })();

  // Risk assessment
  const riskAssessment: OperationalReport['riskAssessment'] = {
    operational: riskLevel(severity),
    financial: discrepancy && Math.abs(discrepancy) > 2 ? riskLevel('major') : riskLevel(severity),
    verificationConfidence: Number((aggregate * 100).toFixed(0)),
  };

  // Escalation decision tree
  const escalationDecision: OperationalReport['escalationDecision'] = (() => {
    if (severity === 'none') {
      return {
        decision: 'monitor',
        justification: `Delivery within tolerance. Aggregate confidence ${(aggregate * 100).toFixed(0)}%. Record to ledger and monitor for patterns.`,
      };
    }
    if (severity === 'minor') {
      return {
        decision: 'review',
        justification: `Minor discrepancy detected (${Math.abs(discrepancy || 0)} ${unit}). Operator review recommended. If evidence gaps present, escalate for data collection.`,
      };
    }
    if (severity === 'moderate') {
      return {
        decision: 'escalate',
        justification: `Moderate discrepancy (${Math.abs(discrepancy || 0)} ${unit}, ${((Math.abs(discrepancy || 0) / Math.max(1, Math.abs(declaredWeight || 1))) * 100).toFixed(1)}% variance). Escalate to operations manager. Verify chain-of-custody and sensor calibration.`,
      };
    }
    // major or critical
    return {
      decision: 'open_incident',
      justification: `${severity.toUpperCase()} severity discrepancy (${Math.abs(discrepancy || 0)} ${unit}). Open formal incident ticket. Notify senior operations and finance. Audit chain-of-custody, verify weighbridge calibration, inspect unloading records, and conduct photo evidence review.`,
    };
  })();

  report.operationalSummary = operationalSummary;
  report.discrepancyExplanation = discrepancyExplanation;
  report.anomalySeverity = severity;
  report.confidenceBreakdown = { anpr: Number(anprConf.toFixed(3)), weighbridge: Number(weighConf.toFixed(3)), invoice: Number(invoiceConf.toFixed(3)), aggregate: Number(aggregate.toFixed(3)) };
  report.possibleCauses = possibleCauses;
  report.escalationRecommendation = escalation;
  
  // Investigation additions
  report.supportingEvidence = supportingEvidence;
  report.conflictingEvidence = conflictingEvidence;
  report.evidenceGaps = evidenceGaps;
  report.confidenceRationale = confidenceRationale;
  report.eventTimeline = eventTimeline;
  report.finding = finding;
  report.riskAssessment = riskAssessment;
  report.escalationDecision = escalationDecision;

  // Attach structured evidence details and chain
  report.supportingEvidenceDetails = supportingDetails;
  report.conflictingEvidenceDetails = conflictingDetails;
  report.chainOfEvidence = chain;

  report.metadata = { vehicle, invoiceId: invoiceBest?.id ?? null, deliveredWeight: deliveredWeight ?? null, declaredWeight: declaredWeight ?? null, discrepancy: discrepancy ?? null, unit, evidenceCount: evidence.length };
  return report as OperationalReport;
}

export function generateAuditSummary(r: OperationalReport): string {
  const vehicle = r.metadata.vehicle || 'Vehicle (unknown)';
  const invoice = r.metadata.invoiceId || 'invoice (unknown)';
  const delivered = r.metadata.deliveredWeight !== null ? `${r.metadata.deliveredWeight}${r.metadata.unit ? ' ' + r.metadata.unit : ''}` : 'N/A';
  const declared = r.metadata.declaredWeight !== null ? `${r.metadata.declaredWeight}${r.metadata.unit ? ' ' + r.metadata.unit : ''}` : 'N/A';
  const severity = (r.anomalySeverity || 'none').toUpperCase();

  const lines: string[] = [];
  // Short factual summary
  lines.push(`${vehicle} delivered ${delivered} while invoice ${invoice} specified ${declared}.`);

  // Discrepancy and severity
  if (r.discrepancyExplanation) lines.push(`Discrepancy: ${r.discrepancyExplanation}`);
  lines.push(`Anomaly severity: ${severity}`);

  // Confidence breakdown with reasons
  const cb = r.confidenceBreakdown || { anpr: 0, weighbridge: 0, invoice: 0, aggregate: 0 };
  const anprPct = Math.round(cb.anpr * 100);
  const weighPct = Math.round(cb.weighbridge * 100);
  const invPct = Math.round(cb.invoice * 100);
  const aggPct = Math.round(cb.aggregate * 100);

  lines.push(`Confidence breakdown (with rationale):`);
  // Use available evidence to explain confidence
  const reasons: string[] = [];
  if ((r as any).supportingEvidence && (r as any).supportingEvidence.length) reasons.push('supporting evidence items present');
  if ((r as any).conflictingEvidence && (r as any).conflictingEvidence.length) reasons.push('conflicting signals observed');
  if ((r as any).evidenceGaps && (r as any).evidenceGaps.length) reasons.push('evidence gaps noted');

  lines.push(`- ANPR: ${anprPct}% (${anprPct >= 90 ? 'high confidence' : anprPct >= 70 ? 'moderate confidence' : 'low confidence'})` + (anprPct > 0 ? ` — ${anprPct >= 90 ? 'clear plate capture' : anprPct >= 70 ? 'partial plate clarity' : 'low image quality or occlusion'}` : ' — ANPR unavailable'));
  lines.push(`- Weighbridge: ${weighPct}% (${weighPct >= 90 ? 'high confidence' : weighPct >= 80 ? 'moderate confidence' : 'low confidence'})` + (weighPct > 0 ? ` — ${weighPct >= 90 ? 'scale reading present and recent' : weighPct >= 80 ? 'scale present but minor uncertainty' : 'sensor or integration issues'}` : ' — weighbridge unavailable'));
  lines.push(`- Invoice: ${invPct}% (${invPct >= 90 ? 'high trust' : invPct >= 70 ? 'moderate trust' : 'low trust'})` + (invPct > 0 ? ` — ${invPct >= 90 ? 'OCR/document trust high' : invPct >= 70 ? 'document present but formatted irregularly' : 'missing or low-trust invoice'}` : ' — invoice unavailable'));
  lines.push(`Aggregate confidence: ${aggPct}% — ${reasons.length ? reasons.join('; ') : 'no additional notes'}.`);

  // Evidence gaps
  if ((r as any).evidenceGaps && (r as any).evidenceGaps.length) {
    lines.push('Evidence gaps (explicit):');
    for (const g of (r as any).evidenceGaps.slice(0, 6)) lines.push(`* ${g}`);
  }

  // Recommended actions (cautious, evidence-driven)
  if (r.escalationRecommendation && r.escalationRecommendation.length) {
    lines.push('Recommended actions:');
    for (const a of r.escalationRecommendation.slice(0, 4)) lines.push(`* ${a}`);
  } else {
    lines.push('Recommended actions: record and monitor; seek additional evidence if uncertainty remains.');
  }

  // Ensure wording is cautious
  return lines.join('\n');
}

export function formatHumanReport(r: OperationalReport): string {
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('INFRASTRUCTURE INVESTIGATION REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Executive summary
  lines.push('EXECUTIVE SUMMARY');
  lines.push('-'.repeat(63));
  lines.push(r.operationalSummary);
  lines.push('');

  // Investigation finding
  lines.push('INVESTIGATION FINDING');
  lines.push('-'.repeat(63));
  lines.push(r.finding);
  lines.push('');

  // Verification summary
  lines.push('VERIFICATION SUMMARY');
  lines.push('-'.repeat(63));
  lines.push(`Severity: ${r.anomalySeverity.toUpperCase()}`);
  lines.push(`Discrepancy: ${r.discrepancyExplanation}`);
  lines.push('');

  // Evidence analysis
  lines.push('EVIDENCE ANALYSIS');
  lines.push('-'.repeat(63));
  lines.push('');
  
  if (r.supportingEvidence.length > 0) {
    lines.push('Supporting Evidence:');
    for (const e of r.supportingEvidence) lines.push(`  ✓ ${e}`);
    lines.push('');
  }
  
  // Structured supporting evidence details when available
  if (r.supportingEvidenceDetails && r.supportingEvidenceDetails.length > 0) {
    lines.push('Supporting Evidence (detailed):');
    for (const e of r.supportingEvidenceDetails) {
      lines.push(`  - ${e.type || 'evidence'}${e.fileName ? ` — ${e.fileName}` : ''}`);
      if (e.timestamp) lines.push(`      Timestamp: ${e.timestamp}`);
      if (e.camera) lines.push(`      Camera: ${e.camera}`);
      if (e.site) lines.push(`      Site: ${e.site}`);
      if (e.hash) lines.push(`      Hash: ${e.hash}`);
      if (typeof e.confidence === 'number') lines.push(`      Confidence: ${Math.round(e.confidence * 100)}%`);
      if (e.note) lines.push(`      Note: ${e.note}`);
    }
    lines.push('');
  }

  if (r.conflictingEvidence.length > 0) {
    lines.push('Conflicting Evidence:');
    for (const e of r.conflictingEvidence) lines.push(`  ✗ ${e}`);
    lines.push('');
  }

  if (r.conflictingEvidenceDetails && r.conflictingEvidenceDetails.length > 0) {
    lines.push('Conflicting Evidence (detailed):');
    for (const e of r.conflictingEvidenceDetails) {
      lines.push(`  - ${e.type || 'evidence'}${e.fileName ? ` — ${e.fileName}` : ''}`);
      if (e.timestamp) lines.push(`      Timestamp: ${e.timestamp}`);
      if (e.camera) lines.push(`      Camera: ${e.camera}`);
      if (e.site) lines.push(`      Site: ${e.site}`);
      if (e.hash) lines.push(`      Hash: ${e.hash}`);
      if (typeof e.confidence === 'number') lines.push(`      Confidence: ${Math.round(e.confidence * 100)}%`);
      if (e.note) lines.push(`      Note: ${e.note}`);
    }
    lines.push('');
  }
  
  if (r.evidenceGaps.length > 0) {
    lines.push('Evidence Gaps:');
    for (const e of r.evidenceGaps) lines.push(`  ⊘ ${e}`);
    lines.push('');
  }
  
  lines.push('Confidence Rationale:');
  lines.push(`  ${r.confidenceRationale}`);
  lines.push('');

  // Event timeline
  lines.push('EVENT TIMELINE');
  lines.push('-'.repeat(63));
  for (const event of r.eventTimeline) {
    lines.push(`  • ${event.event}`);
  }
  lines.push('');

  // Chain of evidence (chronological)
  if (r.chainOfEvidence && r.chainOfEvidence.length > 0) {
    lines.push('CHAIN OF EVIDENCE (chronological)');
    lines.push('-'.repeat(63));
    for (const step of r.chainOfEvidence) {
      lines.push(`  ${step.step}` + (step.evidenceId ? ` — evidence: ${step.evidenceId}` : '') + (step.timestamp ? ` @ ${step.timestamp}` : ''));
    }
    lines.push('');
  }

  // Confidence breakdown
  lines.push('CONFIDENCE ASSESSMENT');
  lines.push('-'.repeat(63));
  lines.push(`ANPR: ${(r.confidenceBreakdown.anpr * 100).toFixed(1)}%`);
  lines.push(`Weighbridge: ${(r.confidenceBreakdown.weighbridge * 100).toFixed(1)}%`);
  lines.push(`Invoice: ${(r.confidenceBreakdown.invoice * 100).toFixed(1)}%`);
  lines.push(`Aggregate Confidence: ${(r.confidenceBreakdown.aggregate * 100).toFixed(1)}%`);
  lines.push('');

  // Possible causes
  if (r.possibleCauses.length > 0) {
    lines.push('POSSIBLE CAUSES');
    lines.push('-'.repeat(63));
    for (const p of r.possibleCauses) lines.push(`  • ${p}`);
    lines.push('');
  }

  // Risk assessment
  lines.push('RISK ASSESSMENT');
  lines.push('-'.repeat(63));
  lines.push(`Operational Risk: ${r.riskAssessment.operational.toUpperCase()}`);
  lines.push(`Financial Risk: ${r.riskAssessment.financial.toUpperCase()}`);
  lines.push(`Verification Confidence: ${r.riskAssessment.verificationConfidence}%`);
  lines.push('');

  // Escalation decision
  lines.push('ESCALATION DECISION');
  lines.push('-'.repeat(63));
  lines.push(`Decision: ${r.escalationDecision.decision.toUpperCase()}`);
  lines.push(`Justification: ${r.escalationDecision.justification}`);
  lines.push('');

  // Recommended actions
  lines.push('RECOMMENDED ACTIONS');
  lines.push('-'.repeat(63));
  for (const e of r.escalationRecommendation) lines.push(`  • ${e}`);
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════════');
  return lines.join('\n');
}
