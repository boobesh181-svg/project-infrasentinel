import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Bot, CheckCircle2, FileText, Lock, MessageSquareWarning, ShieldAlert, Sparkles } from "lucide-react";
import OperationsLayout from "../components/layout/OperationsLayout";
import ForensicTimeline from "../components/ops/ForensicTimeline";
import InvestigationEvidenceRail from "../components/ops/InvestigationEvidenceRail";
import InvestigationReasoningPanel from "../components/ops/InvestigationReasoningPanel";
import { fetchAuditLogs } from "../api/audit";
import { getDelivery } from "../api/ops";
import { getWeighbridgeByDelivery } from "../api/weighbridge";

type CaseStage = "triage" | "reconstruction" | "human_review" | "resolved" | "escalated";

type JournalTone = "info" | "success" | "warning" | "critical";

type JournalEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
  tone: JournalTone;
};

const toneStyles: Record<JournalTone, string> = {
  info: "border-cyan-400/15 bg-cyan-500/10 text-cyan-50",
  success: "border-emerald-400/15 bg-emerald-500/10 text-emerald-50",
  warning: "border-amber-400/15 bg-amber-500/10 text-amber-50",
  critical: "border-rose-400/15 bg-rose-500/10 text-rose-50"
};

const formatCompactTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

const makeJournalEntry = (action: string, detail: string, tone: JournalTone, actor = "operator"): JournalEntry => ({
  id: `${action.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`,
  timestamp: new Date().toISOString(),
  actor,
  action,
  detail,
  tone
});

const AuditReplay = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("delivery_id") || searchParams.get("id");
  const [delivery, setDelivery] = useState<any | null>(null);
  const [weighbridge, setWeighbridge] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [forensicContext, setForensicContext] = useState<any>({});
  const [stage, setStage] = useState<CaseStage>("triage");
  const [reviewState, setReviewState] = useState<"pending" | "human_review" | "closed">("pending");
  const [operatorNote, setOperatorNote] = useState("");
  const [journal, setJournal] = useState<JournalEntry[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const loadedDelivery = await getDelivery(id);
        const loadedWeighbridge = await getWeighbridgeByDelivery(id);
        setDelivery(loadedDelivery);
        setWeighbridge(loadedWeighbridge);
        setSelectedEvidenceId(loadedDelivery?.evidence?.[0]?.id || null);
        setStage(loadedDelivery?.anomaly ? "reconstruction" : "triage");
        setReviewState(loadedDelivery?.anomaly ? "human_review" : "pending");
        setJournal([
          makeJournalEntry("Case loaded", `Delivery ${id} opened for investigation.`, "info", "system")
        ]);

        const auditEntityType = loadedDelivery?.audit_entity_type || loadedDelivery?.entity_type || (loadedDelivery?.material_entry_id ? "MaterialEntry" : null);
        const auditEntityId = loadedDelivery?.audit_entity_id || loadedDelivery?.material_entry_id || loadedDelivery?.id;
        if (auditEntityType && auditEntityId) {
          try {
            const auditLogs = await fetchAuditLogs(String(auditEntityType), String(auditEntityId));
            if (auditLogs.length) {
              setJournal((current) => [
                ...auditLogs.slice(0, 10).map((log) =>
                  makeJournalEntry(
                    `Audit: ${log.action}`,
                    `Audit entry recorded for ${log.entity_type} ${log.entity_id}. Previous and new state are available in the backend trail.`,
                    log.action.toLowerCase().includes("lock") || log.action.toLowerCase().includes("approve") ? "success" : "info",
                    String(log.performed_by_id)
                  )
                ),
                ...current
              ]);
            }
          } catch {
            // Best-effort only. Demo records may not have a compatible backend audit entity.
          }
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load replay data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const evidence = useMemo(() => delivery?.evidence ?? [], [delivery]);

  const activeEvidence = useMemo(() => {
    return evidence.find((item: any) => item.id === selectedEvidenceId) || forensicContext?.selectedEvidence || evidence[0] || null;
  }, [evidence, forensicContext?.selectedEvidence, selectedEvidenceId]);

  const mismatch = Boolean(
    delivery?.weighbridge?.verification_result === "MISMATCH" || weighbridge?.verification_result === "MISMATCH" || delivery?.anomaly_data
  );

  const investigationStatus = useMemo(() => {
    if (!delivery) return "No delivery loaded.";
    if (reviewState === "closed") return "Case closed after synchronized evidence review.";
    if (reviewState === "human_review") return "AI has deferred the decision to an operator.";
    if (mismatch) return "Quantity mismatch requires operator sign-off.";
    return forensicContext?.activeEvent ? "Replay in progress with synchronized reconstruction." : "Replay ready for guided investigation.";
  }, [delivery, forensicContext?.activeEvent, mismatch, reviewState]);

  const caseThesis = useMemo(() => {
    if (!delivery) return "Awaiting case context.";
    if (reviewState === "closed") return "The case is resolved and ready for audit export.";
    if (mismatch) return "Evidence suggests a quantity mismatch between invoice and weighbridge records.";
    if (delivery?.confidence != null && Number(delivery.confidence) >= 0.9) return "The evidence chain is coherent and ready for operator confirmation.";
    return "The investigation is reconstructing an incomplete evidence chain.";
  }, [delivery, mismatch, reviewState]);

  const completion = mismatch ? 70 : reviewState === "closed" ? 100 : delivery?.state === "VERIFIED" ? 95 : 80;

  const appendJournal = (action: string, detail: string, tone: JournalTone, actor = "operator") => {
    setJournal((current) => [makeJournalEntry(action, detail, tone, actor), ...current]);
  };

  const handleAction = async (action: string) => {
    if (action === "REVIEW") {
      setStage("human_review");
      setReviewState("human_review");
      appendJournal("Human review requested", operatorNote || "AI found an evidence continuity gap and requested manual verification.", "warning");
      return;
    }

    if (action === "CONFIRM") {
      setStage("resolved");
      setReviewState("closed");
      appendJournal("Case confirmed", operatorNote || "Operator validated the delivery chain and closed the case.", "success");
      return;
    }

    if (action === "ESCALATE") {
      setStage("escalated");
      setReviewState("human_review");
      appendJournal("Case escalated", operatorNote || "Incident escalated to the incident lead for formal review.", "critical");
    }
  };

  const handleOpenEvidence = (currentEvidence: any) => {
    if (!currentEvidence?.storage_path) return;
    window.open(currentEvidence.storage_path, "_blank");
    appendJournal("Evidence opened", `${currentEvidence.file_name || currentEvidence.id} opened for inspection.`, "info");
  };

  const handleContextChange = (context: any) => {
    setForensicContext(context);
    if (context?.selectedEvidence?.id) {
      setSelectedEvidenceId(context.selectedEvidence.id);
      appendJournal("Evidence synchronized", `Replay aligned to evidence ${context.selectedEvidence.id}.`, "info");
    }
  };

  return (
    <OperationsLayout kicker="InfraSentinel / Incident Investigation" title="Incident Investigation" badges={["forensic workspace", "audit-grade"]}>
      <div className="space-y-6">
        <section className="operational-panel px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                <Bot className="h-4 w-4 text-cyan-300" />
                AI-assisted forensic infrastructure investigation workspace
                <span className="border border-white/10 bg-white/4 px-3 py-1 text-slate-300">human review enabled</span>
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white md:text-4xl">Incident Investigation</h1>
              <p className="max-w-4xl text-sm leading-6 text-slate-300">This workspace reconstructs incidents with synchronized evidence, playback-linked highlighting, and AI reasoning that stays tied to the chain of custody.</p>
            </div>
            <div className="space-y-2 text-right">
              <p className="text-xs text-slate-400">Case</p>
              <p className="text-sm font-medium text-white">{id ?? "(select delivery_id in URL)"}</p>
              <div className="inline-flex items-center gap-2 border border-white/10 bg-white/4 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                {reviewState.replace(/_/g, " ")}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Investigation status</p>
              <p className="mt-2 text-sm text-white">{investigationStatus}</p>
            </div>
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Case thesis</p>
              <p className="mt-2 text-sm text-white">{caseThesis}</p>
            </div>
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Evidence completion</p>
              <p className="mt-2 text-sm text-white">{completion}%</p>
            </div>
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Human review</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                operator decision required before closure
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Operator note</p>
              <textarea
                value={operatorNote}
                onChange={(event) => setOperatorNote(event.target.value)}
                placeholder="Write the operator reason, escalation context, or resolution note here."
                className="mt-2 h-24 w-full resize-none border border-white/10 bg-white/4 p-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Decision workflow</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="border border-white/10 bg-white/4 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300" onClick={() => handleAction("REVIEW")}>
                  Request human review
                </button>
                <button type="button" className="border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100" onClick={() => handleAction("CONFIRM")}>
                  Confirm case
                </button>
                <button type="button" className="border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rose-100" onClick={() => handleAction("ESCALATE")}>
                  Escalate incident
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Stage: {stage}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Review: {reviewState.replace(/_/g, " ")}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Evidence: {evidence.length}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Current evidence: {activeEvidence?.file_name || activeEvidence?.id || "—"}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <div className="space-y-4">
            {loading ? (
              <div className="border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-400">Loading replay...</div>
            ) : error ? (
              <div className="border border-rose-400/20 bg-rose-950/30 p-5 text-sm text-rose-200">{error}</div>
            ) : (
              <InvestigationEvidenceRail
                delivery={delivery}
                selectedEvidenceId={selectedEvidenceId}
                activeEventId={forensicContext?.activeEvent?.id}
                onSelectEvidence={(evidenceItem) => {
                  setSelectedEvidenceId(evidenceItem.id);
                  appendJournal("Evidence selected", `${evidenceItem.file_name || evidenceItem.id} selected from evidence rail.`, "info");
                }}
                onOpenEvidence={handleOpenEvidence}
              />
            )}
          </div>

          <div className="space-y-4">
            {loading || error ? null : (
              <ForensicTimeline
                delivery={delivery}
                weighbridge={weighbridge}
                onOpenEvidence={handleOpenEvidence}
                onAction={handleAction}
                isSubmitting={false}
                selectedEvidenceId={selectedEvidenceId}
                onSelectEvidence={(evidenceItem) => {
                  setSelectedEvidenceId(evidenceItem.id);
                  appendJournal("Timeline evidence pinned", `${evidenceItem.file_name || evidenceItem.id} pinned in replay.`, "info");
                }}
                onContextChange={handleContextChange}
              />
            )}
          </div>

          <div className="space-y-4">
            <InvestigationReasoningPanel
              delivery={delivery}
              weighbridge={weighbridge}
              selectedEvidence={activeEvidence}
              activeEvent={forensicContext?.activeEvent}
              currentState={forensicContext?.currentState || String(delivery?.state || "DETECTED").toUpperCase()}
              confidenceSeries={forensicContext?.confidenceSeries || []}
              anomalyCount={forensicContext?.anomalyCount || 0}
              operatorCount={forensicContext?.operatorCount || 0}
            />

            <section className="operational-panel border border-white/10 bg-slate-950/85 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Audit trace</p>
              <div className="mt-3 space-y-2">
                {journal.slice(0, 5).map((entry) => (
                  <div key={entry.id} className={`border px-3 py-2 text-xs ${toneStyles[entry.tone]}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold uppercase tracking-[0.18em]">{entry.action}</span>
                      <span>{formatCompactTime(entry.timestamp)}</span>
                    </div>
                    <div className="mt-1 text-slate-200">{entry.detail}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">{entry.actor}</div>
                  </div>
                ))}
                {journal.length === 0 ? <div className="text-sm text-slate-400">No journal entries yet.</div> : null}
              </div>
            </section>

            <section className="operational-panel border border-white/10 bg-slate-950/85 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Resolution</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Outcome: {reviewState === "closed" ? "Resolved" : reviewState === "human_review" ? "Pending human review" : mismatch ? "Needs escalation" : "Open"}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Status: {stage}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Selected evidence: {activeEvidence?.file_name || activeEvidence?.id || "—"}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Audit package: {reviewState === "closed" ? "Locked" : "Pending"}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => handleAction("REVIEW")} className="flex items-center gap-2 border border-white/10 bg-white/4 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white">
                  <MessageSquareWarning className="h-4 w-4 text-cyan-300" />
                  Review
                </button>
                <button type="button" onClick={() => handleAction("ESCALATE")} className="flex items-center gap-2 border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rose-100">
                  <AlertTriangle className="h-4 w-4" />
                  Escalate
                </button>
                <button type="button" onClick={() => handleAction("CONFIRM")} className="flex items-center gap-2 border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-emerald-100">
                  <Lock className="h-4 w-4" />
                  Resolve
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <CaseJournal journal={journal} />
          <ResolutionSummary
            reviewState={reviewState}
            stage={stage}
            caseThesis={caseThesis}
            completion={completion}
            mismatch={mismatch}
            activeEvidence={activeEvidence}
            note={operatorNote}
          />
        </div>
      </div>
    </OperationsLayout>
  );
};

const CaseJournal = ({ journal }: { journal: JournalEntry[] }) => (
  <section className="operational-panel border border-white/10 bg-slate-950/85 p-4">
    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Case journal</p>
    <div className="mt-3 space-y-2">
      {journal.map((entry) => (
        <div key={entry.id} className={`border px-3 py-2 text-xs ${toneStyles[entry.tone]}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold uppercase tracking-[0.18em]">{entry.action}</span>
            <span>{formatCompactTime(entry.timestamp)}</span>
          </div>
          <div className="mt-1 text-slate-200">{entry.detail}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">{entry.actor}</div>
        </div>
      ))}
      {journal.length === 0 ? <div className="text-sm text-slate-400">No journal entries yet.</div> : null}
    </div>
  </section>
);

const ResolutionSummary = ({
  reviewState,
  stage,
  caseThesis,
  completion,
  mismatch,
  activeEvidence,
  note
}: {
  reviewState: "pending" | "human_review" | "closed";
  stage: CaseStage;
  caseThesis: string;
  completion: number;
  mismatch: boolean;
  activeEvidence: any;
  note: string;
}) => (
  <section className="operational-panel border border-white/10 bg-slate-950/85 p-4">
    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Resolution summary</p>
    <div className="mt-3 space-y-2 text-sm text-slate-300">
      <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Outcome: {reviewState === "closed" ? "Resolved" : reviewState === "human_review" ? "Pending human review" : mismatch ? "Needs escalation" : "Open"}</div>
      <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Stage: {stage}</div>
      <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Completion: {completion}%</div>
      <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Selected evidence: {activeEvidence?.file_name || activeEvidence?.id || "—"}</div>
      <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Case thesis: {caseThesis}</div>
      <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Operator note: {note || "—"}</div>
      <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Audit package: {reviewState === "closed" ? "Locked" : "Pending"}</div>
    </div>
  </section>
);

export default AuditReplay;