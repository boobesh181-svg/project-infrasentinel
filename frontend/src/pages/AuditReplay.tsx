import OperationsLayout from "../components/layout/OperationsLayout";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ForensicTimeline from "../components/ops/ForensicTimeline";
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

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const d = await getDelivery(id);
        setDelivery(d);
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
    // open in Timeline lightbox via simple event - Timeline handles lightbox internally via prop
    // fallback: open evidence in new tab if storage path exists
    if (evidence?.storage_path) window.open(evidence.storage_path, "_blank");
  };

  const handleAction = async (action: string) => {
    const nextBriefing =
      action === "CONFIRM"
        ? "Timeline confirms the delivery chain. Evidence and weight records align for closure."
        : action === "REVIEW"
          ? "AI suggests human review because the replay still carries unresolved evidence or confidence gaps."
          : "Incident escalated: preserve evidence, review discrepancies, and lock the case after operator confirmation.";
    setBriefing(nextBriefing);
    setReviewState(action === "CONFIRM" ? "closed" : action === "REVIEW" ? "human_review" : "pending");
  };

  const investigationStatus = useMemo(() => {
    if (!delivery) return "No delivery loaded.";
    const mismatch = delivery?.weighbridge?.verification_result === "MISMATCH" || weighbridge?.verification_result === "MISMATCH";
    if (mismatch) return "Quantity mismatch requires operator sign-off.";
    if (reviewState === "human_review") return "AI has deferred the decision to an operator.";
    if (reviewState === "closed") return "Case closed after synchronized evidence review.";
    return "Replay ready for guided investigation.";
  }, [delivery, reviewState, weighbridge]);

  return (
    <OperationsLayout kicker="InfraSentinel / Incident Investigation" title="Incident Investigation" badges={["forensic workspace", "deep investigation"]}>
      <div className="space-y-6">
        <section className="operational-panel px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                <Bot className="h-4 w-4 text-cyan-300" />
                ai-assisted forensic analysis
                <span className="border border-white/10 bg-white/4 px-3 py-1 text-slate-300">human review enabled</span>
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white md:text-4xl">Incident Investigation</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">Flagged deliveries move through synchronized evidence reconstruction, AI-generated briefings, and explicit operator sign-off before closure.</p>
            </div>
            <div className="space-y-2 text-right">
              <p className="text-xs text-slate-400">Delivery</p>
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {loading ? (
              <div className="border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-400">Loading replay...</div>
            ) : error ? (
              <div className="border border-rose-400/20 bg-rose-950/30 p-5 text-sm text-rose-200">{error}</div>
            ) : (
              <ForensicTimeline delivery={delivery} weighbridge={weighbridge} onOpenEvidence={handleOpenEvidence} onAction={handleAction} isSubmitting={false} />
            )}
          </div>

          <aside className="space-y-3">
            <section className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">AI controls</p>
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

            <section className="border border-white/10 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Case notes</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="border border-white/10 bg-white/4 p-3">Use the replay to reconstruct chain-of-custody timing.</div>
                <div className="border border-white/10 bg-white/4 p-3">AI briefing updates as operator choices change the case state.</div>
                <div className="border border-white/10 bg-white/4 p-3">Evidence opens in a separate overlay to preserve context.</div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </OperationsLayout>
  );
};

export default AuditReplay;
