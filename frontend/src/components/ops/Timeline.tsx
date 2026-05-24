import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe2,
  Hash,
  Radar,
  ShieldAlert,
  Sparkles,
  UserRound,
  Waves
} from "lucide-react";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import EvidenceCard from "./EvidenceCard";

type Props = {
  delivery: any;
  onOpenEvidence: (evidence: any) => void;
  onAction: (action: string) => void;
  isSubmitting: boolean;
};

type TimelineFilter = "all" | "evidence" | "verification" | "operator" | "anomaly";
type ReplayMode = "live" | "reconstruction" | "export";

const stageOrder = ["DETECTED", "PROCESSING", "VERIFIED", "FLAGGED", "ESCALATED", "RESOLVED", "ARCHIVED"];

type TimelineEvent = {
  id: string;
  kind: TimelineFilter | "ingest";
  title: string;
  time: string;
  summary: string;
  trust: "trusted" | "review" | "suspect";
  severity: "low" | "medium" | "high";
  evidenceCount?: number;
  details: Array<{ label: string; value: string }>;
  evidence?: any[];
  reasoning?: string;
  actor?: string;
  gps?: string;
  hash?: string;
  sourceId?: string;
};

const buildGps = (lat?: number, lng?: number) => {
  if (lat == null || lng == null) return "GPS unavailable";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
};

const trustLabel = (event: TimelineEvent) => {
  if (event.kind === "anomaly" || event.severity === "high") return "SUSPECT";
  if (event.kind === "operator" || event.kind === "verification") return "TRUSTED";
  return "REVIEW";
};

const stateTone = (state: string) => {
  switch (state) {
    case "DETECTED":
      return "border-cyan-400/20 bg-cyan-500/10 text-cyan-100";
    case "PROCESSING":
      return "border-amber-400/20 bg-amber-500/10 text-amber-100";
    case "VERIFIED":
    case "RESOLVED":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
    case "FLAGGED":
      return "border-rose-400/20 bg-rose-500/10 text-rose-100";
    case "ESCALATED":
      return "border-orange-400/20 bg-orange-500/10 text-orange-100";
    case "ARCHIVED":
      return "border-slate-500/20 bg-slate-800/90 text-slate-100";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
};

const filterCopy: Record<TimelineFilter, string> = {
  all: "All signals",
  evidence: "Evidence",
  verification: "Verification",
  operator: "Operator",
  anomaly: "Anomaly"
};

const replayCopy: Record<ReplayMode, string> = {
  live: "Live replay",
  reconstruction: "Incident reconstruction",
  export: "Export-ready audit"
};

const Timeline = ({ delivery, onOpenEvidence, onAction, isSubmitting }: Props) => {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [mode, setMode] = useState<ReplayMode>("reconstruction");

  const events = useMemo<TimelineEvent[]>(() => {
    const evidence = delivery?.evidence ?? [];
    const verificationResults = delivery?.verification_results ?? [];
    const baseTime = delivery?.occurred_at ?? delivery?.created_at ?? new Date().toISOString();
    const confidence = delivery?.confidence != null ? Number(delivery.confidence) : null;
    const expected = delivery?.expected_quantity != null ? Number(delivery.expected_quantity) : null;
    const detected = delivery?.detected_quantity != null ? Number(delivery.detected_quantity) : null;
    const mismatch = expected != null && detected != null ? Math.abs(expected - detected) : null;

    const ingestEvent: TimelineEvent = {
      id: `ingest-${delivery?.id}`,
      kind: "ingest",
      title: "Delivery ingested",
      time: baseTime,
      summary: `${delivery?.vehicle_plate || "Vehicle"} entered the lane from ${delivery?.supplier || "unknown supplier"}.`,
      trust: confidence != null && confidence >= 0.8 ? "trusted" : confidence != null && confidence >= 0.5 ? "review" : "suspect",
      severity: mismatch && mismatch > 0 ? "high" : confidence != null && confidence < 0.5 ? "high" : "low",
      evidenceCount: evidence.length,
      gps: buildGps(delivery?.gps_lat, delivery?.gps_lng),
      hash: delivery?.id,
      details: [
        { label: "State", value: String(delivery?.state || "INGESTED").toUpperCase() },
        { label: "Site", value: String(delivery?.site_id || "—").slice(0, 8) },
        { label: "Camera", value: delivery?.camera_id || "—" },
        { label: "Vehicle", value: delivery?.vehicle_plate || "—" }
      ]
    };

    const anomalyEvent: TimelineEvent | null =
      mismatch != null || (confidence != null && confidence < 0.8)
        ? {
            id: `anomaly-${delivery?.id}`,
            kind: "anomaly",
            title: "Anomaly checkpoint",
            time: delivery?.occurred_at ?? baseTime,
            summary:
              mismatch != null
                ? `Quantity mismatch detected: expected ${expected ?? "—"}, detected ${detected ?? "—"}.`
                : `Confidence dropped below operational threshold at ${confidence?.toFixed(2) ?? "—"}.`,
            trust: "suspect",
            severity: "high",
            details: [
              { label: "Expected", value: expected != null ? String(expected) : "—" },
              { label: "Detected", value: detected != null ? String(detected) : "—" },
              { label: "Confidence", value: confidence != null ? confidence.toFixed(2) : "—" },
              { label: "Mismatch", value: mismatch != null ? mismatch.toFixed(2) : "—" }
            ]
          }
        : null;

    const verificationEvents = verificationResults.map((result: any, index: number): TimelineEvent => ({
      id: result.id || `verification-${index}`,
      kind: result.analyzer?.startsWith("operator:") ? "operator" : "verification",
      title: result.analyzer?.startsWith("operator:")
        ? `Operator ${result.analyzer.split(":")[1] || "action"}`
        : `AI checkpoint: ${result.analyzer || "analysis"}`,
      time: result.created_at || baseTime,
      summary: result.reasoning || "No reasoning provided.",
      trust: result.analyzer?.startsWith("operator:")
        ? "trusted"
        : result.confidence != null && result.confidence >= 0.8
          ? "trusted"
          : "review",
      severity: result.analyzer?.startsWith("operator:")
        ? "low"
        : result.confidence != null && result.confidence < 0.5
          ? "high"
          : "medium",
      actor: result.analyzer?.startsWith("operator:") ? result.analyzer.replace("operator:", "") : "AI processor",
      hash: `${delivery?.id}-${result.id}`,
      reasoning: result.reasoning,
      details: [
        { label: "Confidence", value: result.confidence != null ? Number(result.confidence).toFixed(2) : "—" },
        { label: "Analyzer", value: result.analyzer || "—" },
        { label: "Timestamp", value: format(new Date(result.created_at || baseTime), "yyyy-MM-dd HH:mm:ss") }
      ]
    }));

    const evidenceEvents = evidence.map((item: any, index: number): TimelineEvent => ({
      id: item.id || `evidence-${index}`,
      kind: "evidence",
      title: item.file_name || "Evidence artifact",
      time: item.uploaded_at || baseTime,
      summary: item.content_type || item.file_type || "Evidence attached to incident.",
      trust: item.file_hash ? "trusted" : "review",
      severity: item.file_hash ? "low" : "medium",
      evidenceCount: evidence.length,
      evidence: [item],
      actor: item.uploaded_by ? String(item.uploaded_by).slice(0, 8) : "system",
      hash: item.file_hash,
      details: [
        { label: "Uploaded", value: format(new Date(item.uploaded_at), "yyyy-MM-dd HH:mm:ss") },
        { label: "Type", value: item.content_type || item.file_type || "—" },
        { label: "Hash", value: item.file_hash || "—" },
        { label: "Storage", value: item.storage_path ? "available" : "missing" }
      ]
    }));

    return [ingestEvent, anomalyEvent, ...verificationEvents, ...evidenceEvents]
      .filter(Boolean)
      .sort((left, right) => new Date(left!.time).getTime() - new Date(right!.time).getTime()) as TimelineEvent[];
  }, [delivery]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((event) => event.kind === filter || (filter === "operator" && event.kind === "verification" && event.actor?.toLowerCase().includes("operator")));
  }, [events, filter]);

  const currentState = String(delivery?.state || "DETECTED").toUpperCase();
  const currentStageIndex = Math.max(0, stageOrder.indexOf(currentState));

  const confidenceSeries = useMemo(
    () =>
      [delivery?.confidence, ...(delivery?.verification_results ?? []).map((result: any) => result.confidence)]
        .filter((value): value is number => typeof value === "number")
        .map((value) => Number(value.toFixed(2))),
    [delivery]
  );

  const structuredExport = useMemo(
    () => ({
      delivery_id: delivery?.id,
      site_id: delivery?.site_id,
      vehicle_plate: delivery?.vehicle_plate,
      supplier: delivery?.supplier,
      occurred_at: delivery?.occurred_at,
      state: delivery?.state,
      gps: { lat: delivery?.gps_lat, lng: delivery?.gps_lng },
      evidence_count: delivery?.evidence?.length || 0,
      verification_count: delivery?.verification_results?.length || 0,
      chain_of_custody: (delivery?.evidence || []).map((item: any) => ({
        evidence_id: item.id,
        hash: item.file_hash,
        uploaded_at: item.uploaded_at,
        uploaded_by: item.uploaded_by
      }))
    }),
    [delivery]
  );

  const anomalyCount = events.filter((event) => event.kind === "anomaly").length;
  const operatorCount = events.filter((event) => event.kind === "operator").length;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Forensic replay</p>
            <h3 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Incident reconstruction timeline</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Every event communicates what happened, when it happened, why it matters, whether it is trusted, and what evidence exists.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Events", value: events.length },
              { label: "Anomalies", value: anomalyCount },
              { label: "Operators", value: operatorCount }
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {(Object.keys(filterCopy) as TimelineFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
                filter === item
                  ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              {filterCopy[item]}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
          {(Object.keys(replayCopy) as ReplayMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-full border px-3 py-1.5 transition ${
                mode === item
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {replayCopy[item]}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Live state</p>
              <div className="mt-2 flex items-center gap-3">
                <Badge label={currentState} />
                <span className="text-sm text-slate-300">{replayCopy[mode]}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              websocket-driven replay
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-7">
            {stageOrder.map((stage, index) => {
              const active = index <= currentStageIndex;
              const current = index === currentStageIndex;
              return (
                <div
                  key={stage}
                  className={`rounded-2xl border px-3 py-3 text-center text-[11px] uppercase tracking-[0.22em] transition ${
                    active ? stateTone(stage) : "border-white/10 bg-slate-950/40 text-slate-500"
                  } ${current ? "shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_26px_rgba(34,211,238,0.18)]" : ""}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-current" : "bg-slate-600"} ${current ? "animate-pulse" : ""}`} />
                    <span>{stage}</span>
                  </div>
                  <p className="mt-2 text-[10px] tracking-[0.18em] text-slate-300/70">
                    {active ? (current ? "current" : "completed") : "queued"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="space-y-4">
          {filteredEvents.length ? (
            filteredEvents.map((event, index) => (
              <article key={event.id} className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.38)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={event.kind.toUpperCase()} />
                      <Badge label={trustLabel(event)} />
                      {event.details.find((detail) => detail.label === "State") ? (
                        <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.18em] ${stateTone(String(event.details.find((detail) => detail.label === "State")?.value || ""))}`}>
                          {event.details.find((detail) => detail.label === "State")?.value}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                        {format(new Date(event.time), "yyyy-MM-dd HH:mm:ss")}
                      </span>
                    </div>
                    <h4 className="mt-4 text-xl font-semibold text-white">{event.title}</h4>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{event.summary}</p>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span className={`h-2.5 w-2.5 rounded-full ${event.trust === "trusted" ? "bg-emerald-400" : event.trust === "review" ? "bg-amber-400" : "bg-rose-400"}`} />
                    <span className="text-xs uppercase tracking-[0.2em]">{event.trust}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {event.details.map((detail) => (
                    <div key={`${event.id}-${detail.label}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{detail.label}</p>
                      <p className="mt-2 break-words text-sm text-slate-100">{detail.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
                    {format(new Date(event.time), "HH:mm:ss")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <Globe2 className="h-3.5 w-3.5 text-cyan-300" />
                    {event.gps || "GPS unavailable"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <Hash className="h-3.5 w-3.5 text-cyan-300" />
                    {event.hash || "chain marker unavailable"}
                  </span>
                  {event.actor ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      <UserRound className="h-3.5 w-3.5 text-cyan-300" />
                      {event.actor}
                    </span>
                  ) : null}
                </div>

                {event.reasoning ? (
                  <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI reasoning snippet
                    </div>
                    <p className="mt-2 text-sm leading-6 text-cyan-50/90">{event.reasoning}</p>
                  </div>
                ) : null}

                {event.kind === "evidence" && event.evidence?.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {event.evidence.map((item) => (
                      <EvidenceCard key={item.id} evidence={item} onOpen={onOpenEvidence} />
                    ))}
                  </div>
                ) : null}

                {event.kind === "anomaly" ? (
                  <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-rose-100">
                      <AlertTriangle className="h-4 w-4" />
                      anomaly overlay
                    </div>
                    <p className="mt-2">Mismatch or confidence degradation pushed this incident into escalation review.</p>
                  </div>
                ) : null}

                {index !== filteredEvents.length - 1 ? (
                  <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                    next checkpoint
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-[26px] border border-dashed border-white/10 bg-slate-950/60 p-8 text-sm text-slate-400">
              No replay events match the selected filter.
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <Radar className="h-4 w-4 text-cyan-300" />
              confidence progression
            </div>
            <div className="mt-4 space-y-3">
              {confidenceSeries.length ? (
                confidenceSeries.map((score, index) => (
                  <div key={`${score}-${index}`}>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Checkpoint {index + 1}</span>
                      <span>{score.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      {(() => {
                        const widthClasses = ["w-[8%]", "w-[16%]", "w-[24%]", "w-[32%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[72%]", "w-[84%]", "w-[92%]", "w-full"];
                        const widthIndex = Math.min(widthClasses.length - 1, Math.max(0, Math.round(score * 10)));
                        return (
                      <div
                        className={`h-full rounded-full ${widthClasses[widthIndex]} ${score >= 0.8 ? "bg-emerald-400" : score >= 0.5 ? "bg-amber-400" : "bg-rose-400"}`}
                      />
                        );
                      })()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  No confidence checkpoints yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <Waves className="h-4 w-4 text-cyan-300" />
              incident reconstruction
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Delivery: {delivery?.vehicle_plate || "unknown"}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Supplier: {delivery?.supplier || "unknown"}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">GPS: {buildGps(delivery?.gps_lat, delivery?.gps_lng)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Evidence items: {delivery?.evidence?.length || 0}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Verification results: {delivery?.verification_results?.length || 0}</div>
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <ArrowDownRight className="h-4 w-4 text-cyan-300" />
              chain-of-custody
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {(delivery?.evidence || []).length ? (
                delivery.evidence.map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="font-medium text-white">{item.file_name}</p>
                    <p className="mt-1 text-xs text-slate-400">Hash: {item.file_hash || "—"}</p>
                    <p className="mt-1 text-xs text-slate-400">Uploaded: {item.uploaded_at ? format(new Date(item.uploaded_at), "yyyy-MM-dd HH:mm:ss") : "—"}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  No custody markers recorded yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <ShieldAlert className="h-4 w-4 text-cyan-300" />
              replay actions
            </div>
            <div className="mt-4 space-y-3">
              <Button className="w-full justify-start" onClick={() => onAction("CONFIRM")} disabled={isSubmitting}>
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                Confirm checkpoint
              </Button>
              <Button className="w-full justify-start" variant="secondary" onClick={() => onAction("REVIEW")} disabled={isSubmitting}>
                <ChevronRight className="mr-2 inline h-4 w-4" />
                Escalate for review
              </Button>
              <Button className="w-full justify-start" variant="danger" onClick={() => onAction("ESCALATE")} disabled={isSubmitting}>
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Mark incident
              </Button>
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <Hash className="h-4 w-4 text-cyan-300" />
              export-ready audit structure
            </div>
            <pre className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-5 text-slate-300">
{JSON.stringify(structuredExport, null, 2)}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default Timeline;