import React, { useEffect, useMemo, useState } from 'react';
import { generateOperationalReport, formatHumanReport, EvidenceEntry, OperationalReport } from '../../lib/operationalVerificationAssistant';

type Props = {
  delivery: any;
  weighbridge?: any;
  selectedEvidence?: any | null;
  activeEvent?: any | null;
  currentState?: string | null;
  confidenceSeries?: number[];
  anomalyCount?: number;
  operatorCount?: number;
};

const scoreBar = (v: number) => {
  const pct = Math.round(v * 100);
  const widthClass = pct < 10 ? "w-[10%]" : pct < 20 ? "w-[20%]" : pct < 30 ? "w-[30%]" : pct < 40 ? "w-[40%]" : pct < 50 ? "w-[50%]" : pct < 60 ? "w-[60%]" : pct < 70 ? "w-[70%]" : pct < 80 ? "w-[80%]" : pct < 90 ? "w-[90%]" : "w-full";
  return (
    <div className="w-full overflow-hidden rounded bg-slate-800/30 h-3">
      <div className={`h-3 rounded bg-emerald-400 ${widthClass}`} />
    </div>
  );
};

export default function InvestigationReasoningPanel(props: Props) {
  const { delivery, selectedEvidence, activeEvent, currentState, confidenceSeries = [], anomalyCount = 0, operatorCount = 0 } = props;

  const evidence: EvidenceEntry[] = useMemo(() => {
    // normalize delivery.evidence into EvidenceEntry[] shape expected by assistant
    return (delivery?.evidence || []).map((e: any) => ({
      id: e.id,
      fileName: e.file_name || e.fileName || e.fileName,
      timestamp: e.uploaded_at || e.timestamp,
      site: e.site_name || e.site,
      camera: e.camera_id || e.camera,
      fileHash: e.file_hash || e.fileHash,
      note: e.operational_note || e.note,
      // include inferred sub-entries when available
      anpr: e.anpr || (e.file_name && e.file_name.toLowerCase().includes('anpr') ? { plate: delivery?.vehicle_plate, confidence: delivery?.confidence ?? 0.8 } : undefined),
      weighbridge: e.weighbridge || undefined,
      invoice: e.invoice || (e.invoice_number || e.supplier_name ? { id: e.invoice_number || e.file_name, declaredWeight: delivery?.expected_quantity } : undefined)
    }));
  }, [delivery]);

  const [report, setReport] = useState<OperationalReport | null>(null);
  const [expanded, setExpanded] = useState(false);

  const truncateHash = (h?: string) => {
    if (!h) return '—';
    if (h.length <= 16) return h;
    return `${h.slice(0, 8)}…${h.slice(-6)}`;
  };

  useEffect(() => {
    // Recompute report when evidence or selection or activeEvent / state changes
    const rpt = generateOperationalReport(evidence as any[] || []);
    setReport(rpt);
  }, [evidence, selectedEvidence?.id, activeEvent?.id, currentState, JSON.stringify(confidenceSeries), anomalyCount, operatorCount]);

  if (!report) return <div className="p-3 text-sm text-slate-400">Computing investigation summary…</div>;

  const riskBg = report.riskAssessment?.operational === 'critical' ? 'bg-red-900/30' : 
                 report.riskAssessment?.operational === 'high' ? 'bg-orange-900/30' :
                 report.riskAssessment?.operational === 'medium' ? 'bg-yellow-900/30' : 'bg-blue-900/30';

  return (
    <div className={`p-3 ${riskBg} rounded border border-slate-800 text-slate-100 text-sm`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase text-slate-400">Case reasoning</div>
        <div className="text-xs text-slate-400">Evidence: {report.metadata.evidenceCount}</div>
      </div>

      <section className="mb-3 p-2 bg-slate-900/50 rounded border border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-cyan-300">Case thesis</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{report.riskAssessment?.operational || "unknown"}</div>
        </div>
        {report.finding && <div className="text-sm text-slate-200 mt-1">{report.finding}</div>}
      </section>

      <section className="mb-3">
        <div className="text-[13px] font-medium">What happened</div>
        <div className="text-sm text-slate-200 mt-1">{report.operationalSummary}</div>
      </section>

      <section className="mb-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-medium">Why it matters</div>
          <div className={`px-2 py-0.5 text-xs rounded ${report.anomalySeverity === 'none' ? 'bg-emerald-500 text-black' : report.anomalySeverity === 'minor' ? 'bg-yellow-500 text-black' : report.anomalySeverity === 'moderate' ? 'bg-amber-600' : report.anomalySeverity === 'major' ? 'bg-orange-600' : 'bg-rose-600'}`}>{report.anomalySeverity.toUpperCase()}</div>
        </div>
        <div className="text-slate-300 text-sm mt-1">{report.discrepancyExplanation}</div>
      </section>

      {report.riskAssessment && (
        <section className="mb-3 p-2 bg-slate-900/50 rounded">
          <div className="text-[13px] font-medium mb-1">Risk Assessment</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-slate-400">Operational</div>
              <div className="text-slate-200 font-semibold uppercase">{report.riskAssessment.operational}</div>
            </div>
            <div>
              <div className="text-slate-400">Financial</div>
              <div className="text-slate-200 font-semibold uppercase">{report.riskAssessment.financial}</div>
            </div>
            <div>
              <div className="text-slate-400">Verification</div>
              <div className="text-slate-200 font-semibold">{report.riskAssessment.verificationConfidence}%</div>
            </div>
          </div>
        </section>
      )}

      <section className="mb-3">
        <div className="text-[13px] font-medium mb-1">Evidence confidence</div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>ANPR</div>
            <div className="w-2/5 text-right">{Math.round(report.confidenceBreakdown.anpr * 100)}%</div>
          </div>
          <div>{scoreBar(report.confidenceBreakdown.anpr)}</div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>Weighbridge</div>
            <div className="w-2/5 text-right">{Math.round(report.confidenceBreakdown.weighbridge * 100)}%</div>
          </div>
          <div>{scoreBar(report.confidenceBreakdown.weighbridge)}</div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <div>Invoice</div>
            <div className="w-2/5 text-right">{Math.round(report.confidenceBreakdown.invoice * 100)}%</div>
          </div>
          <div>{scoreBar(report.confidenceBreakdown.invoice)}</div>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
            <div>Aggregate</div>
            <div className="w-2/5 text-right">{Math.round(report.confidenceBreakdown.aggregate * 100)}%</div>
          </div>
          <div>{scoreBar(report.confidenceBreakdown.aggregate)}</div>
        </div>
        {report.confidenceRationale && (
          <div className="text-xs text-slate-400 mt-2 italic">{report.confidenceRationale}</div>
        )}
      </section>

      <section className="mb-3">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-[13px] font-medium text-cyan-400 hover:text-cyan-300 w-full text-left"
        >
          {expanded ? '▼' : '▶'} Evidence trail ({(report.supportingEvidence?.length || 0) + (report.conflictingEvidence?.length || 0)} items)
        </button>
        {expanded && (
          <div className="mt-2 space-y-2 text-xs">
            {report.supportingEvidence && report.supportingEvidence.length > 0 && (
              <div>
                <div className="text-emerald-400">Supporting:</div>
                <ul className="ml-3 text-slate-300 space-y-1">
                  {report.supportingEvidence.map((e, i) => (
                    <li key={i}>✓ {e}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.conflictingEvidence && report.conflictingEvidence.length > 0 && (
              <div>
                <div className="text-amber-400">Conflicting:</div>
                <ul className="ml-3 text-slate-300 space-y-1">
                  {report.conflictingEvidence.map((e, i) => (
                    <li key={i}>✗ {e}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.evidenceGaps && report.evidenceGaps.length > 0 && (
              <div>
                <div className="text-slate-400">Gaps:</div>
                <ul className="ml-3 text-slate-400 space-y-1">
                  {report.evidenceGaps.map((e, i) => (
                    <li key={i}>⊘ {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Structured supporting evidence details */}
            {report.supportingEvidenceDetails && report.supportingEvidenceDetails.length > 0 && (
              <div>
                <div className="text-emerald-400 mt-2">Supporting Evidence (detailed)</div>
                <div className="mt-1 grid gap-2">
                  {report.supportingEvidenceDetails.map((e, i) => (
                    <div key={i} className="p-2 bg-slate-800/40 rounded border border-slate-700">
                      <div className="text-xs text-slate-200 font-semibold">{e.type || 'evidence'}{e.fileName ? ` — ${e.fileName}` : ''}</div>
                      <div className="text-[11px] text-slate-400 mt-1 grid grid-cols-2 gap-1">
                        <div>Timestamp: <span className="text-slate-300">{e.timestamp || '—'}</span></div>
                        <div>Site: <span className="text-slate-300">{e.site || '—'}</span></div>
                        <div>Camera: <span className="text-slate-300">{e.camera || '—'}</span></div>
                        <div>Hash: <span className="text-slate-300">{truncateHash(e.hash)}</span></div>
                        <div>Confidence: <span className="text-slate-300">{typeof e.confidence === 'number' ? Math.round(e.confidence * 100) + '%' : '—'}</span></div>
                        <div>Note: <span className="text-slate-300">{e.note || '—'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Structured conflicting evidence details */}
            {report.conflictingEvidenceDetails && report.conflictingEvidenceDetails.length > 0 && (
              <div>
                <div className="text-amber-400 mt-2">Conflicting Evidence (detailed)</div>
                <div className="mt-1 grid gap-2">
                  {report.conflictingEvidenceDetails.map((e, i) => (
                    <div key={i} className="p-2 bg-slate-800/40 rounded border border-slate-700">
                      <div className="text-xs text-slate-200 font-semibold">{e.type || 'evidence'}{e.fileName ? ` — ${e.fileName}` : ''}</div>
                      <div className="text-[11px] text-slate-400 mt-1 grid grid-cols-2 gap-1">
                        <div>Timestamp: <span className="text-slate-300">{e.timestamp || '—'}</span></div>
                        <div>Site: <span className="text-slate-300">{e.site || '—'}</span></div>
                        <div>Camera: <span className="text-slate-300">{e.camera || '—'}</span></div>
                        <div>Hash: <span className="text-slate-300">{truncateHash(e.hash)}</span></div>
                        <div>Confidence: <span className="text-slate-300">{typeof e.confidence === 'number' ? Math.round(e.confidence * 100) + '%' : '—'}</span></div>
                        <div>Note: <span className="text-slate-300">{e.note || '—'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chain of evidence (chronological) */}
            {report.chainOfEvidence && report.chainOfEvidence.length > 0 && (
              <div>
                <div className="text-slate-400 mt-2">Chain of Evidence (chronological)</div>
                <ol className="ml-3 mt-1 text-slate-300 text-xs list-decimal space-y-1">
                  {report.chainOfEvidence.map((s, i) => (
                    <li key={i}>{s.step}{s.evidenceId ? ` — ${s.evidenceId}` : ''}{s.timestamp ? ` @ ${s.timestamp}` : ''}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </section>

      {report.escalationDecision && (
        <section className="mb-3 p-2 bg-slate-900/50 rounded border border-slate-700">
          <div className="text-[13px] font-medium mb-1">Decision</div>
          <div className="text-sm font-semibold text-cyan-300 uppercase">{report.escalationDecision.decision}</div>
          <div className="text-xs text-slate-300 mt-1">{report.escalationDecision.justification}</div>
        </section>
      )}

      <section className="mb-3">
        <div className="text-[13px] font-medium">Possible causes</div>
        <ul className="list-disc ml-4 text-slate-300 mt-1 text-xs">
          {report.possibleCauses.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="mb-2">
        <div className="text-[13px] font-medium">Recommended actions</div>
        <ul className="ml-4 list-none text-slate-300 mt-1 space-y-1 text-xs">
          {report.escalationRecommendation.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
      </section>

      <section className="pt-2 border-t border-slate-800 text-xs text-slate-500">
        <div>Operator context: <span className="text-slate-300">{currentState || '—'}</span></div>
        <div>Active event: <span className="text-slate-300">{activeEvent?.type || '—'}</span></div>
      </section>
    </div>
  );
}