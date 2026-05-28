import { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDownRight,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FileText,
  Globe2,
  Hash,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
  Waves
} from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import EvidenceCard from "./EvidenceCard";

type Props = {
  delivery: any;
  weighbridge?: any | null;
  onOpenEvidence: (evidence: any) => void;
  onAction: (action: string) => void;
  isSubmitting: boolean;
};

type TimelineFilter = "all" | "evidence" | "verification" | "operator" | "anomaly" | "weighbridge";
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
  anomaly: "Anomaly",
  weighbridge: "Weighbridge"
};

const replayCopy: Record<ReplayMode, string> = {
  live: "Live replay",
  reconstruction: "Incident reconstruction",
  export: "Export-ready audit"
};

const Timeline = ({ delivery, weighbridge, onOpenEvidence, onAction, isSubmitting }: Props) => {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [mode, setMode] = useState<ReplayMode>("reconstruction");
  const [query, setQuery] = useState("");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [previewEvidence, setPreviewEvidence] = useState<any | null>(null);
  const [lightboxEvidence, setLightboxEvidence] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const events = useMemo<TimelineEvent[]>(() => {
    const evidence = delivery?.evidence ?? [];
    const verificationResults = delivery?.verification_results ?? [];
    const baseTime = delivery?.occurred_at ?? delivery?.created_at ?? new Date().toISOString();
    const confidence = delivery?.confidence != null ? Number(delivery.confidence) : null;
    const expected = delivery?.expected_quantity != null ? Number(delivery.expected_quantity) : null;
    const detected = delivery?.detected_quantity != null ? Number(delivery.detected_quantity) : null;
    const mismatch = expected != null && detected != null ? Math.abs(expected - detected) : null;
    const plate = delivery?.detected_plate || delivery?.vehicle_plate || "—";
    const supplier = delivery?.supplier || "—";
    const materialType = delivery?.detected_material_type || "—";
    const invoiceLink = delivery?.invoice_links?.[0];
    const weighbridgeNet = weighbridge?.net_weight != null ? String(weighbridge.net_weight) : "—";
    const weighbridgeExpected = weighbridge?.expected_quantity != null ? String(weighbridge.expected_quantity) : "—";
    const weighbridgeMismatch = weighbridge?.mismatch_percent != null ? `${(weighbridge.mismatch_percent * 100).toFixed(1)}%` : "—";

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
        { label: "Vehicle", value: plate },
        { label: "Supplier", value: supplier },
        { label: "Material", value: materialType },
        { label: "Invoice", value: invoiceLink?.invoice_id ? String(invoiceLink.invoice_id).slice(0, 8) : "—" },
        { label: "Weighbridge", value: weighbridgeNet !== "—" ? `${weighbridgeNet} ${weighbridge?.unit || "kg"}` : "pending" }
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
        { label: "Timestamp", value: format(new Date(result.created_at || baseTime), "yyyy-MM-dd HH:mm:ss") },
        { label: "Vehicle", value: plate },
        { label: "Supplier", value: supplier }
      ]
    }));

    const weighbridgeEvent: TimelineEvent | null = weighbridge
      ? {
          id: `weighbridge-${weighbridge.id}`,
          kind: "weighbridge",
          title: "Weighbridge verification",
          time: weighbridge.tare_captured_at || weighbridge.gross_captured_at || baseTime,
          summary: weighbridge.tare_captured_at
            ? `Net ${weighbridgeNet} ${weighbridge.unit || "kg"} validated against invoice ${weighbridgeExpected}.`
            : "Gross captured. Awaiting tare to finalize verification.",
          trust: weighbridge.anomaly_flags?.length ? "suspect" : "trusted",
          severity: weighbridge.anomaly_flags?.length ? "high" : "low",
          reasoning: weighbridge.anomaly_flags?.length
            ? `Flags: ${(weighbridge.anomaly_flags || []).join(", ")}`
            : "Weighbridge verification cleared.",
          details: [
            { label: "Gross", value: `${weighbridge.gross_weight} ${weighbridge.unit || "kg"}` },
            { label: "Tare", value: weighbridge.tare_weight != null ? `${weighbridge.tare_weight} ${weighbridge.unit || "kg"}` : "—" },
            { label: "Net", value: `${weighbridgeNet} ${weighbridge.unit || "kg"}` },
            { label: "Invoice", value: weighbridgeExpected },
            { label: "Mismatch", value: weighbridgeMismatch },
            { label: "Status", value: weighbridge.status }
          ]
        }
      : null;

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

    return [ingestEvent, anomalyEvent, weighbridgeEvent, ...verificationEvents, ...evidenceEvents]
      .filter(Boolean)
      .sort((left, right) => new Date(left!.time).getTime() - new Date(right!.time).getTime()) as TimelineEvent[];
  }, [delivery, weighbridge]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const vehicleTerm = vehicleQuery.trim().toLowerCase();
    const supplierTerm = supplierQuery.trim().toLowerCase();
    return events.filter((event) => {
      const matchesFilter =
        filter === "all" ||
        event.kind === filter ||
        (filter === "operator" && event.kind === "verification" && event.actor?.toLowerCase().includes("operator"));
      if (!matchesFilter) return false;

      const searchHaystack = [event.title, event.summary, event.reasoning, event.actor, plate, supplier, materialType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const vehicleMatches = !vehicleTerm || searchHaystack.includes(vehicleTerm);
      const supplierMatches = !supplierTerm || searchHaystack.includes(supplierTerm);
      const queryMatches = !normalizedQuery || searchHaystack.includes(normalizedQuery);
      return vehicleMatches && supplierMatches && queryMatches;
    });
  }, [events, filter, query, supplierQuery, vehicleQuery]);

  const currentState = String(delivery?.state || "DETECTED").toUpperCase();
  const currentStageIndex = Math.max(0, stageOrder.indexOf(currentState));

  const confidenceSeries = useMemo(() => {
    const base = [delivery?.confidence, ...(delivery?.verification_results ?? []).map((result: any) => result.confidence)]
      .filter((value): value is number => typeof value === "number")
      .map((value) => Number(value.toFixed(2)));
    if (weighbridge?.mismatch_percent != null) {
      const score = Math.max(0, 1 - Number(weighbridge.mismatch_percent));
      base.push(Number(score.toFixed(2)));
    }
    return base;
  }, [delivery, weighbridge]);

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
      })),
      weighbridge: weighbridge
        ? {
            gross_weight: weighbridge.gross_weight,
            tare_weight: weighbridge.tare_weight,
            net_weight: weighbridge.net_weight,
            mismatch_percent: weighbridge.mismatch_percent,
            status: weighbridge.status
          }
        : null
    }),
    [delivery, weighbridge]
  );

  const anomalyCount = events.filter((event) => event.kind === "anomaly").length;
  const operatorCount = events.filter((event) => event.kind === "operator").length;
  const chainEvidence = delivery?.evidence ?? [];
  const anomalies = delivery?.suspicious_flags || [];
  const plate = delivery?.detected_plate || delivery?.vehicle_plate || "—";
  const supplier = delivery?.supplier || "—";
  const materialType = delivery?.detected_material_type || "—";
  const invoiceLink = delivery?.invoice_links?.[0];
  const imageEvidence = chainEvidence.find((item: any) => String(item.content_type || "").startsWith("image"));
  const operatorNotes = (delivery?.verification_results || []).filter((result: any) =>
    String(result.analyzer || "").startsWith("operator:")
  );
  const previewImage = previewEvidence && String(previewEvidence.content_type || "").startsWith("image")
    ? previewEvidence.storage_path
    : null;
  const lightboxImage = lightboxEvidence && String(lightboxEvidence.content_type || "").startsWith("image")
    ? lightboxEvidence.storage_path
    : null;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => {
        const next = i + 1 < filteredEvents.length ? i + 1 : 0;
        const el = itemRefs.current[next];
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [isPlaying, filteredEvents.length]);

  return (
    <>
      <div className="space-y-6">
      <section className="border border-cyan-400/10 bg-slate-950/85 p-4">
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
              <div key={metric.label} className="border border-white/10 bg-white/4 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-cyan-400/10 bg-slate-950/75 p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Primary incident</p>
                <h4 className="mt-2 text-xl font-semibold text-white">{plate} · {supplier}</h4>
                <p className="mt-2 text-sm text-slate-300">Material: {materialType}</p>
              </div>
              <Badge label={currentState} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[0.6fr_0.4fr]">
              <div className="overflow-hidden border border-cyan-400/10 bg-slate-900/70">
                {imageEvidence?.storage_path ? (
                  <img src={imageEvidence.storage_path} alt="Truck evidence" className="h-[220px] w-full object-cover" />
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
                    Truck image pending.
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">AI confidence</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {delivery?.confidence != null ? Number(delivery.confidence).toFixed(2) : "—"}
                  </p>
                </div>
                <div className="border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Invoice reference</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm text-white">{invoiceLink?.invoice_id ? String(invoiceLink.invoice_id).slice(0, 8) : "—"}</span>
                    <Link to="/app/command-center/invoices" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-200">
                      <FileText className="h-3.5 w-3.5" />
                      retrieve
                    </Link>
                  </div>
                </div>
                <div className="border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Weighbridge</p>
                  <p className="mt-2 text-sm text-white">
                    {weighbridge?.net_weight != null
                      ? `${weighbridge.net_weight} ${weighbridge.unit || "kg"}`
                      : "Pending net weight"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-rose-400/20 bg-slate-950/75 p-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Anomaly overlay</p>
            <div className="mt-3 space-y-3">
              {anomalies.length ? (
                anomalies.map((flag: string) => (
                  <div key={flag} className="flex items-center justify-between border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      {flag.replace(/_/g, " ")}
                    </div>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  No anomalies flagged in this replay.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Verification state</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge label={currentState} />
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{replayCopy[mode]}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <label className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            <Search className="h-4 w-4 text-cyan-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search timeline events"
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500"
              aria-label="Search timeline"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={vehicleQuery}
              onChange={(event) => setVehicleQuery(event.target.value)}
              placeholder="Vehicle lookup"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500"
              aria-label="Vehicle lookup"
            />
            <input
              value={supplierQuery}
              onChange={(event) => setSupplierQuery(event.target.value)}
              placeholder="Supplier lookup"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500"
              aria-label="Supplier lookup"
            />
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
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-sm text-slate-300"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-sm text-slate-300"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(filteredEvents.length - 1, i + 1))}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-sm text-slate-300"
            >
              Next
            </button>
          </div>
          <div className="text-xs text-slate-400">Replay index: {currentIndex + 1} / {Math.max(1, filteredEvents.length)}</div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="space-y-4">
          {filteredEvents.length ? (
            filteredEvents.map((event, index) => (
              <article
                key={event.id}
                ref={(el) => (itemRefs.current[index] = el)}
                className={`relative border p-4 transition ${
                  index === currentIndex ? 'border-cyan-400/50 bg-slate-900/70' : 'border-white/10 bg-slate-950/75'
                }`}
              >
                <span className="absolute left-4 top-6 h-3 w-3 rounded-full bg-cyan-300" />
                {index !== filteredEvents.length - 1 && <span className="absolute left-5 top-14 bottom-5 w-px bg-white/6" />}
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
                      <span className="border border-white/10 bg-white/4 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
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
                    <div key={`${event.id}-${detail.label}`} className="border border-white/10 bg-white/4 p-2.5">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{detail.label}</p>
                      <p className="mt-2 break-words text-sm text-slate-100">{detail.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-2 border border-white/10 bg-white/4 px-3 py-1">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
                    {format(new Date(event.time), "HH:mm:ss")}
                  </span>
                  <span className="inline-flex items-center gap-2 border border-white/10 bg-white/4 px-3 py-1">
                    <Globe2 className="h-3.5 w-3.5 text-cyan-300" />
                    {event.gps || "GPS unavailable"}
                  </span>
                  <span className="inline-flex items-center gap-2 border border-white/10 bg-white/4 px-3 py-1">
                    <Hash className="h-3.5 w-3.5 text-cyan-300" />
                    {event.hash || "chain marker unavailable"}
                  </span>
                  {event.actor ? (
                    <span className="inline-flex items-center gap-2 border border-white/10 bg-white/4 px-3 py-1">
                      <UserRound className="h-3.5 w-3.5 text-cyan-300" />
                      {event.actor}
                    </span>
                  ) : null}
                </div>

                {event.reasoning ? (
                  <div className="mt-4 border border-cyan-400/20 bg-cyan-500/10 p-3">
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
                      <div
                        key={item.id}
                        onMouseEnter={() => setPreviewEvidence(item)}
                        onMouseLeave={() => setPreviewEvidence(null)}
                      >
                        <EvidenceCard evidence={item} onOpen={onOpenEvidence} />
                      </div>
                    ))}
                  </div>
                ) : null}

                {event.kind === "anomaly" ? (
                  <div className="mt-4 border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
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
            <div className="border border-dashed border-white/10 bg-slate-950/60 p-6 text-sm text-slate-400">
              No replay events match the selected filter.
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <FileText className="h-4 w-4 text-cyan-300" />
              evidence preview
            </div>
            <div className="mt-4 border border-white/10 bg-white/4 p-3">
              {previewEvidence ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>Selected artifact</span>
                    <button
                      type="button"
                      onClick={() => setLightboxEvidence(previewEvidence)}
                      className="text-cyan-200"
                    >
                      open
                    </button>
                  </div>
                  {previewImage ? (
                    <img src={previewImage} alt="Evidence preview" className="h-40 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/60 p-4 text-xs text-slate-400">
                      No image preview available for this artifact.
                    </div>
                  )}
                  <div className="text-xs text-slate-400">
                    <p className="text-sm text-white">{previewEvidence.file_name || "Evidence artifact"}</p>
                    <p className="mt-1">Hash: {previewEvidence.file_hash || "—"}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/60 p-4 text-xs text-slate-400">
                  Hover evidence cards or custody markers to preview.
                </div>
              )}
            </div>
          </section>
          <section className="border border-white/10 bg-slate-950/70 p-4">
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

          <section className="border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <Waves className="h-4 w-4 text-cyan-300" />
              forensic dossier
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Vehicle: {plate}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Supplier: {supplier}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Material: {materialType}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Invoice: {invoiceLink?.invoice_id ? String(invoiceLink.invoice_id).slice(0, 8) : "pending"}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">GPS: {buildGps(delivery?.gps_lat, delivery?.gps_lng)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">Weighbridge net: {weighbridge?.net_weight != null ? `${weighbridge.net_weight} ${weighbridge.unit || "kg"}` : "pending"}</div>
            </div>
          </section>

          <section className="border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <ArrowDownRight className="h-4 w-4 text-cyan-300" />
              chain-of-custody
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {chainEvidence.length ? (
                chainEvidence.map((item: any, index: number) => (
                  <div
                    key={item.id}
                    className="relative rounded-2xl border border-white/10 bg-white/5 p-3 pl-6 transition hover:border-cyan-400/30"
                    onMouseEnter={() => setPreviewEvidence(item)}
                    onMouseLeave={() => setPreviewEvidence(null)}
                  >
                    {index !== chainEvidence.length - 1 ? (
                      <span className="absolute left-3 top-6 h-[calc(100%-24px)] w-px bg-white/10" />
                    ) : null}
                    <span className="absolute left-2 top-4 h-2 w-2 rounded-full bg-cyan-300" />
                    <p className="font-medium text-white">{item.file_name}</p>
                    <p className="mt-1 text-xs text-slate-400">Hash: {item.file_hash || "—"}</p>
                    <p className="mt-1 text-xs text-slate-400">Uploaded: {item.uploaded_at ? format(new Date(item.uploaded_at), "yyyy-MM-dd HH:mm:ss") : "—"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewEvidence(item)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300"
                      >
                        preview
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenEvidence(item)}
                        className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100"
                      >
                        open
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  No custody markers recorded yet.
                </div>
              )}
            </div>
          </section>

          <section className="border border-white/10 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <UserRound className="h-4 w-4 text-cyan-300" />
              operator notes
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {operatorNotes.length ? (
                operatorNotes.map((note: any, index: number) => (
                  <div key={note.id || index} className="border border-white/10 bg-white/4 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge label={(note.analyzer || "operator").toUpperCase()} />
                      <span className="text-xs text-slate-500">{note.created_at ? format(new Date(note.created_at), "HH:mm:ss") : "—"}</span>
                    </div>
                    <p className="mt-2 text-sm text-white">{note.reasoning || "Operator action recorded."}</p>
                  </div>
                ))
              ) : (
                <div className="border border-dashed border-white/10 bg-white/4 p-3 text-sm text-slate-400">
                  No operator notes recorded yet.
                </div>
              )}
            </div>
          </section>

          <section className="border border-white/10 bg-slate-950/70 p-4">
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

          <section className="border border-white/10 bg-slate-950/70 p-4">
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
    {lightboxEvidence ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
        onClick={() => setLightboxEvidence(null)}
        role="presentation"
      >
        <div
          className="w-full max-w-4xl border border-white/10 bg-slate-950/90 p-4"
          onClick={(event) => event.stopPropagation()}
          role="presentation"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Evidence lightbox</p>
              <p className="mt-1 text-sm text-white">{lightboxEvidence.file_name || "Evidence artifact"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenEvidence(lightboxEvidence)}
                className="border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100"
              >
                open full
              </button>
              <button
                type="button"
                onClick={() => setLightboxEvidence(null)}
                className="border border-white/10 bg-white/4 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300"
              >
                close
              </button>
            </div>
          </div>
          <div className="mt-4">
            {lightboxImage ? (
              <img src={lightboxImage} alt="Evidence lightbox" className="max-h-[70vh] w-full object-contain" />
            ) : (
              <div className="border border-dashed border-white/10 bg-slate-950/60 p-6 text-sm text-slate-400">
                No image preview available for this artifact.
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="border border-white/10 bg-white/4 px-3 py-1">Hash: {lightboxEvidence.file_hash || "—"}</span>
            <span className="border border-white/10 bg-white/4 px-3 py-1">Type: {lightboxEvidence.content_type || lightboxEvidence.file_type || "—"}</span>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
};

export default Timeline;