import OperationsLayout from "../components/layout/OperationsLayout";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ForensicTimeline from "../components/ops/ForensicTimeline";
import InvestigationEvidenceRail from "../components/ops/InvestigationEvidenceRail";
import InvestigationReasoningPanel from "../components/ops/InvestigationReasoningPanel";
import { getDelivery } from "../api/ops";
import { getWeighbridgeByDelivery } from "../api/weighbridge";
import { Bot, CheckCircle2, FileText, ShieldAlert, Sparkles } from "lucide-react";

const AuditReplay = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("delivery_id") || searchParams.get("id");
  const [delivery, setDelivery] = useState<any | null>(null);
  const [weighbridge, setWeighbridge] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string>("Awaiting investigation context.");
  const [reviewState, setReviewState] = useState<"pending" | "human_review" | "closed">("pending");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [forensicContext, setForensicContext] = useState<any>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const d = await getDelivery(id);
        setDelivery(d);
        setSelectedEvidenceId(d?.evidence?.[0]?.id || null);
        const w = await getWeighbridgeByDelivery(id);
        setWeighbridge(w);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load replay data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleOpenEvidence = (evidence: any) => {
    if (evidence?.storage_path) window.open(evidence.storage_path, "_blank");
  };

  const handleAction = async (action: string) => {
    const nextBriefing =
      action === "CONFIRM"
        ? "The replay aligns across image, invoice, and weight records. The case can be closed with an auditable operator sign-off."
        : action === "REVIEW"
          ? "The investigation assistant found a gap in chain continuity. Human review is required before the record is locked."
          : "Incident escalated: preserve evidence, freeze closure, and route the case to the incident lead.";
    setBriefing(nextBriefing);
    setReviewState(action === "CONFIRM" ? "closed" : action === "REVIEW" ? "human_review" : "pending");
  };

  const activeEvidence = useMemo(() => {
    const evidence = delivery?.evidence ?? [];
    return evidence.find((item: any) => item.id === selectedEvidenceId) || forensicContext?.selectedEvidence || evidence[0] || null;
  }, [delivery, forensicContext?.selectedEvidence, selectedEvidenceId]);

  const investigationStatus = useMemo(() => {
    if (!delivery) return "No delivery loaded.";
    const mismatch = delivery?.weighbridge?.verification_result === "MISMATCH" || weighbridge?.verification_result === "MISMATCH";
    if (mismatch) return "Quantity mismatch requires operator sign-off.";
    if (reviewState === "human_review") return "AI has deferred the decision to an operator.";
    if (reviewState === "closed") return "Case closed after synchronized evidence review.";
    return forensicContext?.activeEvent ? "Replay in progress with synchronized reconstruction." : "Replay ready for guided investigation.";
  }, [delivery, forensicContext?.activeEvent, reviewState, weighbridge]);

  const handleContextChange = (context: any) => {
    setForensicContext(context);
    if (context?.selectedEvidence?.id) setSelectedEvidenceId(context.selectedEvidence.id);
  };

  return (
    <OperationsLayout kicker="InfraSentinel / Incident Investigation" title="Incident Investigation" badges={["forensic workspace", "deep investigation"]}>
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

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Investigation status</p>
              <p className="mt-2 text-sm text-white">{investigationStatus}</p>
            </div>
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">AI briefing</p>
              <p className="mt-2 text-sm text-white">{briefing}</p>
            </div>
            <div className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Human review</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                operator decision required before closure
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
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
                onSelectEvidence={(evidence) => setSelectedEvidenceId(evidence.id)}
                onOpenEvidence={handleOpenEvidence}
              />
            )}
          </div>

          <div className="space-y-4">
            {loading ? null : error ? null : (
              <ForensicTimeline
                delivery={delivery}
                weighbridge={weighbridge}
                onOpenEvidence={handleOpenEvidence}
                onAction={handleAction}
                isSubmitting={false}
                selectedEvidenceId={selectedEvidenceId}
                onSelectEvidence={(evidence) => setSelectedEvidenceId(evidence.id)}
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
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Case controls</p>
              <div className="mt-3 space-y-2">
                <button type="button" onClick={() => handleAction("REVIEW")} className="flex w-full items-center justify-between border border-white/10 bg-white/4 px-3 py-2 text-left text-sm text-white">
                  <span>Generate review brief</span>
                  <FileText className="h-4 w-4 text-cyan-300" />
                </button>
                <button type="button" onClick={() => handleAction("CONFIRM")} className="flex w-full items-center justify-between border border-white/10 bg-white/4 px-3 py-2 text-left text-sm text-white">
                  <span>Mark human-validated</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </button>
                <button type="button" onClick={() => handleAction("ESCALATE")} className="flex w-full items-center justify-between border border-white/10 bg-white/4 px-3 py-2 text-left text-sm text-white">
                  <span>Escalate to incident lead</span>
                  <ShieldAlert className="h-4 w-4 text-rose-300" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </OperationsLayout>
  );
};

export default AuditReplay;
