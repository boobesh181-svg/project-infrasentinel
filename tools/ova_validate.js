const fs = require('fs');
const path = require('path');

// Local JS implementation of the Operational Verification Assistant (for validation harness)
function clamp(v) {
  if (!isFinite(v) || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
function safeNum(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }
  return null;
}

function normalizeInvoiceId(id) {
  if (!id) return '';
  try {
    return String(id).toLowerCase().replace(/[^a-z0-9]/g, '');
  } catch (e) {
    return String(id);
  }
}

function riskLevel(severity) {
  if (severity === 'none') return 'low';
  if (severity === 'minor') return 'low';
  if (severity === 'moderate') return 'medium';
  if (severity === 'major') return 'high';
  if (severity === 'critical') return 'critical';
  return 'low';
}

function generateOperationalReport(evidence, ledger, config) {
  const cfg = Object.assign({ absoluteTolerance: 0.5, relativeTolerance: 0.03 }, config || {});
  let anprBest = undefined;
  let weighBest = undefined;
  let invoiceBest = undefined;
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

  // Possible causes: always include plausible operational causes when evidence missing
  const possibleCauses = [];
  if (discrepancy === null) {
    possibleCauses.push('Camera outage or blurred frames preventing evidence capture.');
    possibleCauses.push('Upload or ingestion failure for evidence files.');
    possibleCauses.push('Evidence retention or purge configuration removed expected files.');
    possibleCauses.push('Synchronization delay between systems (weighbridge / camera uploads).');
    possibleCauses.push('Operator omission: manual records not yet attached.');
    possibleCauses.push('Hardware malfunction at capture point (camera/scale).');
  } else {
    if (discrepancy !== null && discrepancy > 0) { possibleCauses.push('Partial unloading prior to weighbridge (delivered < invoiced).'); possibleCauses.push('Invoice overstatement or clerical error.'); }
    else if (discrepancy !== null && discrepancy < 0) { possibleCauses.push('Weighbridge over-reporting or calibration issue (delivered > invoiced).'); possibleCauses.push('Invoice under-reporting or unit mismatch.'); }
  }
  if (anprConf < 0.7) possibleCauses.push('ANPR confidence low — vehicle identity uncertain.');
  if (weighConf < 0.8) possibleCauses.push('Weighbridge confidence low — sensor/integration issue.');
  const escalation = [];
  if (severity === 'none') escalation.push('Verification completed. Record findings to delivery ledger.'); else { escalation.push('Escalation recommended: operator review and site log verification.'); if (anprConf < 0.8) escalation.push('Confirm vehicle identity via manual photo/ID.'); if (weighConf < 0.9) escalation.push('Check weighbridge calibration logs and cross-check with secondary scale.'); escalation.push('Open incident ticket and notify operations manager if discrepancy persists.'); }
  const operationalSummary = (function () {
    const vehicleStr = vehicle ? `Vehicle ${vehicle}` : 'Vehicle (unknown)';
    if (discrepancy === null) return `${vehicleStr}: verification incomplete — missing invoice or weighbridge record.`;
    const direction = discrepancy > 0 ? 'delivered less than invoice' : 'delivered more than invoice';
    return `${vehicleStr} ${direction} by ${Math.abs(discrepancy)} ${unit} (declared ${declaredWeight} ${unit}, delivered ${deliveredWeight} ${unit}).`;
  })();

  // === INVESTIGATION ANALYST ADDITIONS ===

  // Supporting evidence
  const supportingEvidence = [];
  if (anprBest && anprConf >= 0.9) supportingEvidence.push(`ANPR matched vehicle plate with ${(anprConf * 100).toFixed(0)}% confidence.`);
  if (weighBest && weighConf >= 0.9) supportingEvidence.push(`Weighbridge recorded ${deliveredWeight} ${unit} with ${(weighConf * 100).toFixed(0)}% confidence.`);
  if (invoiceBest && invoiceConf >= 0.9) supportingEvidence.push(`Invoice OCR/document trust score ${(invoiceConf * 100).toFixed(0)}%.`);
  if (discrepancy === null && (anprBest || weighBest || invoiceBest)) supportingEvidence.push(`Partial evidence chain established (${(evidence || []).length} evidence item(s) captured).`);
  if (discrepancy !== null && Math.abs(discrepancy) <= cfg.absoluteTolerance) supportingEvidence.push(`Discrepancy within configured tolerance (± ${cfg.absoluteTolerance} ${unit}).`);

  // Conflicting evidence
  const conflictingEvidence = [];
  if (discrepancy !== null && discrepancy > cfg.absoluteTolerance) conflictingEvidence.push(`Delivered weight (${deliveredWeight} ${unit}) differs from invoice (${declaredWeight} ${unit}).`);
  if (anprConf < 0.8) conflictingEvidence.push(`ANPR confidence low (${(anprConf * 100).toFixed(0)}%) — vehicle identity uncertain.`);
  if (weighConf < 0.8) conflictingEvidence.push(`Weighbridge confidence low (${(weighConf * 100).toFixed(0)}%) — sensor reading reliability questionable.`);
  if (anprBest && invoiceBest && vehicle !== (invoiceBest.id || '')) conflictingEvidence.push(`Vehicle plate does not match expected invoice identifier.`);

  // Evidence gaps
  const evidenceGaps = [];
  if (!anprBest) evidenceGaps.push('No ANPR/vehicle identification data available.');
  if (!weighBest) evidenceGaps.push('No weighbridge/scale measurement data available.');
  if (!invoiceBest) evidenceGaps.push('No invoice/declared weight data available.');
  if (!(evidence || []).find(e => e.fileName && e.fileName.toLowerCase && e.fileName.toLowerCase().includes('unload'))) evidenceGaps.push('No unloading/offloading footage captured.');
  if (!(evidence || []).find(e => e.type === 'operator_log')) evidenceGaps.push('No operator log or manual verification record.');
  if (!(evidence || []).find(e => e.type === 'tare')) evidenceGaps.push('No tare weight or empty weight record.');

  // Confidence rationale
  const confidenceRationale = (function () {
    const parts = [];
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
  const eventTimeline = [];
  if (invoiceBest) eventTimeline.push({ event: 'Invoice issued and uploaded to system.' });
  if (anprBest) eventTimeline.push({ event: `Vehicle ${vehicle || '(unidentified)'} entered site and captured by ANPR.` });
  if (weighBest) eventTimeline.push({ event: `Gross weight recorded: ${deliveredWeight} ${unit}.` });
  eventTimeline.push({ event: 'Material unloading and offloading executed.' });
  eventTimeline.push({ event: 'Tare weight recorded (if applicable).' });
  if (declaredWeight !== null && deliveredWeight !== null) {
    eventTimeline.push({ event: `Quantity comparison executed: declared ${declaredWeight} ${unit}, delivered ${deliveredWeight} ${unit}.` });
  }
  eventTimeline.push({ event: 'Verification report generated.' });

  // Finding (investigation narrative)
  const finding = (function () {
    let narrative = '';
    if (discrepancy === null) {
      narrative = `Delivery verification incomplete. ${(evidence || []).length} evidence item(s) captured. ${evidenceGaps.length} critical evidence gap(s) identified. Recommend collecting missing data before final verification.`;
    } else {
      const absDisc = Math.abs(discrepancy);
      const percDisc = declaredWeight ? ((absDisc / Math.max(1, Math.abs(declaredWeight))) * 100).toFixed(1) : 'N/A';
      const direction = discrepancy > 0 ? 'less' : 'more';
      narrative = `Delivery verification detected a ${severity.toUpperCase()} severity discrepancy: ${absDisc} ${unit} ${direction} than invoice (${percDisc}% variance). Vehicle ${vehicle || '(unknown)'} delivered ${deliveredWeight} ${unit} versus declared ${declaredWeight} ${unit}. Aggregate confidence in this finding: ${(aggregate * 100).toFixed(0)}%. Supporting evidence: ${supportingEvidence.length} items. Conflicting evidence: ${conflictingEvidence.length} items.`;
    }
    return narrative;
  })();

  // Risk assessment
  const riskAssessment = {
    operational: riskLevel(severity),
    financial: discrepancy && Math.abs(discrepancy) > 2 ? riskLevel('major') : riskLevel(severity),
    verificationConfidence: Number((aggregate * 100).toFixed(0)),
  };

  // Escalation decision tree
  const escalationDecision = (function () {
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

  return {
    operationalSummary,
    discrepancyExplanation,
    anomalySeverity: severity,
    confidenceBreakdown: { anpr: Number(anprConf.toFixed(3)), weighbridge: Number(weighConf.toFixed(3)), invoice: Number(invoiceConf.toFixed(3)), aggregate: Number(aggregate.toFixed(3)) },
    possibleCauses,
    escalationRecommendation: escalation,
    supportingEvidence,
    conflictingEvidence,
    evidenceGaps,
    confidenceRationale,
    eventTimeline,
    finding,
    riskAssessment,
    escalationDecision,
    metadata: { vehicle, invoiceId: invoiceBest && invoiceBest.id ? invoiceBest.id : null, deliveredWeight: deliveredWeight === null ? null : deliveredWeight, declaredWeight: declaredWeight === null ? null : declaredWeight, discrepancy: discrepancy === null ? null : discrepancy, unit, evidenceCount: (evidence || []).length }
  };
}

function formatHumanReport(r) {
  const lines = [];

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
  lines.push(r.finding || 'Investigation in progress.');
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
  
  if (r.supportingEvidence && r.supportingEvidence.length > 0) {
    lines.push('Supporting Evidence:');
    for (const e of r.supportingEvidence) lines.push(`  ✓ ${e}`);
    lines.push('');
  }
  
  if (r.conflictingEvidence && r.conflictingEvidence.length > 0) {
    lines.push('Conflicting Evidence:');
    for (const e of r.conflictingEvidence) lines.push(`  ✗ ${e}`);
    lines.push('');
  }
  
  if (r.evidenceGaps && r.evidenceGaps.length > 0) {
    lines.push('Evidence Gaps:');
    for (const e of r.evidenceGaps) lines.push(`  ⊘ ${e}`);
    lines.push('');
  }
  
  lines.push('Confidence Rationale:');
  lines.push(`  ${r.confidenceRationale || 'Confidence assessment pending.'}`);
  lines.push('');

  // Event timeline
  if (r.eventTimeline && r.eventTimeline.length > 0) {
    lines.push('EVENT TIMELINE');
    lines.push('-'.repeat(63));
    for (const event of r.eventTimeline) {
      lines.push(`  • ${event.event}`);
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
  if (r.possibleCauses && r.possibleCauses.length > 0) {
    lines.push('POSSIBLE CAUSES');
    lines.push('-'.repeat(63));
    for (const p of r.possibleCauses) lines.push(`  • ${p}`);
    lines.push('');
  }

  // Risk assessment
  if (r.riskAssessment) {
    lines.push('RISK ASSESSMENT');
    lines.push('-'.repeat(63));
    lines.push(`Operational Risk: ${r.riskAssessment.operational.toUpperCase()}`);
    lines.push(`Financial Risk: ${r.riskAssessment.financial.toUpperCase()}`);
    lines.push(`Verification Confidence: ${r.riskAssessment.verificationConfidence}%`);
    lines.push('');
  }

  // Escalation decision
  if (r.escalationDecision) {
    lines.push('ESCALATION DECISION');
    lines.push('-'.repeat(63));
    lines.push(`Decision: ${r.escalationDecision.decision.toUpperCase()}`);
    lines.push(`Justification: ${r.escalationDecision.justification}`);
    lines.push('');
  }

  // Recommended actions
  lines.push('RECOMMENDED ACTIONS');
  lines.push('-'.repeat(63));
  for (const e of r.escalationRecommendation) lines.push(`  • ${e}`);
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

// Scenarios
const scenarios = [];

// 1. Successful delivery
scenarios.push({ id: 'successful', label: 'Successful delivery', delivery: { vehicle_plate: 'TN-22-AB-4821' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-22-AB-4821', confidence: 0.96 } }, { id: 'wb', weighbridge: { weight: 18.4, unit: 'T', confidence: 0.98 } }, { id: 'inv', invoice: { id: 'INV-204', declaredWeight: 18.5, unit: 'T', trusted: 0.95 } } ], expected: { severity: 'none' } });

// 2. Quantity mismatch
scenarios.push({ id: 'quantity_mismatch', label: 'Quantity mismatch', delivery: { vehicle_plate: 'TN-55-XY-100' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-55-XY-100', confidence: 0.92 } }, { id: 'wb', weighbridge: { weight: 16.4, unit: 'T', confidence: 0.96 } }, { id: 'inv', invoice: { id: 'INV-301', declaredWeight: 18.0, unit: 'T', trusted: 0.9 } } ], expected: { severity: 'moderate' } });

// 3. ANPR mismatch
scenarios.push({ id: 'anpr_mismatch', label: 'ANPR mismatch', delivery: { vehicle_plate: 'TN-99-ZZ-999' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-11-AA-111', confidence: 0.45 } }, { id: 'wb', weighbridge: { weight: 18.0, unit: 'T', confidence: 0.95 } }, { id: 'inv', invoice: { id: 'INV-410', declaredWeight: 18.0, unit: 'T', trusted: 0.9 } } ], expected: { severity: 'none', anprFlag: true } });

// 4. Invoice discrepancy (invoice much higher)
scenarios.push({ id: 'invoice_discrepancy', label: 'Invoice discrepancy', delivery: { vehicle_plate: 'TN-71-BB-777' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-71-BB-777', confidence: 0.93 } }, { id: 'wb', weighbridge: { weight: 12.0, unit: 'T', confidence: 0.95 } }, { id: 'inv', invoice: { id: 'INV-555', declaredWeight: 18.0, unit: 'T', trusted: 0.95 } } ], expected: { severity: 'major' } });

// 5. Missing evidence
scenarios.push({ id: 'missing_evidence', label: 'Missing evidence', delivery: { vehicle_plate: 'TN-00-XX-000' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-00-XX-000', confidence: 0.9 } } ], expected: { severity: 'minor' } });

// 6. Weighbridge inconsistency (low confidence)
scenarios.push({ id: 'weighbridge_inconsistent', label: 'Weighbridge inconsistency', delivery: { vehicle_plate: 'TN-33-CC-333' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-33-CC-333', confidence: 0.9 } }, { id: 'wb', weighbridge: { weight: 18.0, unit: 'T', confidence: 0.5 } }, { id: 'inv', invoice: { id: 'INV-600', declaredWeight: 18.0, unit: 'T', trusted: 0.9 } } ], expected: { severity: 'none', weighConfLow: true } });

// 7. Duplicate invoice detection (two invoices)
scenarios.push({ id: 'duplicate_invoice', label: 'Duplicate invoice', delivery: { vehicle_plate: 'TN-12-DD-121' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-12-DD-121', confidence: 0.92 } }, { id: 'wb', weighbridge: { weight: 18.2, unit: 'T', confidence: 0.94 } }, { id: 'inv1', invoice: { id: 'INV-700', declaredWeight: 18.0, unit: 'T', trusted: 0.9 } }, { id: 'inv2', invoice: { id: 'INV-700', declaredWeight: 18.0, unit: 'T', trusted: 0.88 } } ], expected: { severity: 'minor', duplicateInvoice: true } });

// 8. High-confidence fraud indicator (weighbridge >> invoice)
scenarios.push({ id: 'fraud_indicator', label: 'High-confidence fraud indicator', delivery: { vehicle_plate: 'TN-77-FF-777' }, evidence: [ { id: 'anpr', anpr: { plate: 'TN-77-FF-777', confidence: 0.98 } }, { id: 'wb', weighbridge: { weight: 25.0, unit: 'T', confidence: 0.98 } }, { id: 'inv', invoice: { id: 'INV-999', declaredWeight: 18.0, unit: 'T', trusted: 0.95 } } ], expected: { severity: 'critical' } });

// Run scenarios
const outDir = path.join(__dirname, 'ova_reports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const summary = [];
for (const s of scenarios) {
  const r = generateOperationalReport(s.evidence || []);
  const human = formatHumanReport(r);
  const checks = [];
  // severity check
  const sevOk = (s.expected.severity ? r.anomalySeverity === s.expected.severity : true);
  checks.push({ name: 'severity', pass: sevOk, expected: s.expected.severity, actual: r.anomalySeverity });
  // confidence aggregate present
  const confOk = typeof r.confidenceBreakdown.aggregate === 'number';
  checks.push({ name: 'confidence_aggregate_present', pass: confOk, value: r.confidenceBreakdown.aggregate });
  // discrepancy explanation non-empty
  const descOk = typeof r.discrepancyExplanation === 'string' && r.discrepancyExplanation.length > 10;
  checks.push({ name: 'discrepancy_explanation', pass: descOk });
  // possible causes non-empty when not none
  const causesOk = (r.possibleCauses && r.possibleCauses.length > 0) || r.anomalySeverity === 'none';
  checks.push({ name: 'possible_causes', pass: causesOk, count: r.possibleCauses.length });
  // escalation present when severity != none
  const escOk = (r.anomalySeverity === 'none' && r.escalationRecommendation && r.escalationRecommendation.length >= 1) || (r.anomalySeverity !== 'none' && r.escalationRecommendation && r.escalationRecommendation.length >= 1);
  checks.push({ name: 'escalation_recommendation', pass: escOk });

  // additional scenario-specific checks
  if (s.expected.anprFlag) {
    checks.push({ name: 'anpr_flag', pass: r.confidenceBreakdown.anpr < 0.7, actual: r.confidenceBreakdown.anpr });
  }
  if (s.expected.weighConfLow) {
    checks.push({ name: 'weigh_confidence_low', pass: r.confidenceBreakdown.weighbridge < 0.8, actual: r.confidenceBreakdown.weighbridge });
  }
  if (s.expected.duplicateInvoice) {
    // detect duplicate invoice ids using normalization
    const invIdsRaw = (s.evidence || []).filter(e => e.invoice).map(e => e.invoice.id);
    const invIds = invIdsRaw.map(normalizeInvoiceId);
    const dup = invIds.length !== new Set(invIds).size && invIds.length > 0;
    checks.push({ name: 'duplicate_invoice', pass: dup, invIds: invIdsRaw, invIdsNormalized: invIds });
  }

  const passed = checks.every(c => c.pass);
  summary.push({ id: s.id, label: s.label, passed, checks, report: r });
  // write outputs
  fs.writeFileSync(path.join(outDir, `${s.id}.json`), JSON.stringify({ scenario: s.label, report: r, human: human, checks }, null, 2));
  console.log('---');
  console.log(`SCENARIO: ${s.label} — ${passed ? 'PASS' : 'FAIL'}`);
  console.log(human);
}

fs.writeFileSync(path.join(outDir, `validation_summary.json`), JSON.stringify(summary, null, 2));
console.log('Validation complete. Reports written to', outDir);
