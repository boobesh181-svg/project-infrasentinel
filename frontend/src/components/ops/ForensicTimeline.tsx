import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addMinutes, format, subDays } from "date-fns";
import EvidenceCard from "./EvidenceCard";
import InvoiceEvidenceModal from "./InvoiceEvidenceModal";
import { useOpsStream } from "../../hooks/useOpsStream";

type Delivery = any;

type QueueItem = {
  id: string;
  plate: string;
  supplier: string;
  state: string;
  updatedAt: string;
  alert?: string;
};

const random = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

const suppliers = ["Acme Aggregates", "Titan Steel", "Gita Crushers", "Narayana Sand Co.", "Karan Bricks"];
const materials = ["Cement", "Aggregate", "Steel", "Sand", "Fly Ash", "Bitumen", "Bricks"];
const projects = ["Eastern Corridor", "Metro Segment-4", "Delta Port Road", "Ring Expressway"];
const sites = ["Site 01", "Site 02", "Gate Yard A", "Plant South"];

const sampleImage = (type: string, plate = "TN-01-AB1234") => {
  const map: Record<string, string[]> = {
    anpr: ["/assets/realistic/anpr-1.jpg", "/assets/realistic/anpr-2.jpg"],
    weighbridge: ["/assets/realistic/weighbridge-1.jpg", "/assets/realistic/weighbridge-2.jpg"],
    invoice: ["/assets/realistic/invoice-1.png", "/assets/realistic/invoice-2.png"],
    truck: ["/assets/realistic/truck-arrival-1.jpg", "/assets/realistic/truck-arrival-2.jpg", "/assets/realistic/truck-arrival-3.jpg"],
    unload: ["/assets/realistic/unloading-1.jpg", "/assets/realistic/unloading-2.jpg"],
    industrial: ["/assets/realistic/industrial-checkpoint-1.jpg", "/assets/realistic/industrial-checkpoint-2.jpg"]
  };
  const list = map[type] || map.truck;
  const seed = Array.from(plate).reduce((s, c) => s + c.charCodeAt(0), 0);
  return list[seed % list.length];
};

const makeDelivery = (date: Date, idx: number): Delivery => {
  const supplier = suppliers[idx % suppliers.length];
  const material = materials[(idx * 3) % materials.length];
  const project = projects[idx % projects.length];
  const site = sites[(idx + 1) % sites.length];
  const plate = `TN-${random(10, 99)}-${String.fromCharCode(65 + random(0, 25))}${random(10, 99)}-${random(1000, 9999)}`;
  const expected = Number((random(8, 30) + Math.random()).toFixed(2));
  const gross = Number((expected + random(8, 14) + Math.random()).toFixed(2));
  const tare = Number((random(2, 4) + Math.random()).toFixed(2));
  const net = Number((gross - tare).toFixed(2));
  const confidence = Number((0.72 + Math.random() * 0.27).toFixed(2));
  const diff = Number((expected - net).toFixed(2));
  const anomalyProbability = Number((Math.abs(diff) / expected).toFixed(2));
  const anomaly = Math.abs(diff) > 1.3;
  const invoiceId = `INV-${date.getFullYear().toString().slice(-2)}-${random(10000, 99999)}`;
  const gateEntry = addMinutes(date, random(1, 6));
  const unloadAt = addMinutes(gateEntry, random(10, 35));
  const operatorAt = addMinutes(unloadAt, random(5, 15));

  const evidence = [
    { id: `ev-${plate}-arrival`, file_name: `${plate}-arrival.jpg`, storage_path: sampleImage("truck", plate), content_type: "image/jpeg", uploaded_at: date.toISOString(), file_hash: Math.random().toString(36).slice(2, 12) },
    { id: `ev-${plate}-anpr`, file_name: `${plate}-anpr.jpg`, storage_path: sampleImage("anpr", plate), content_type: "image/jpeg", uploaded_at: gateEntry.toISOString(), file_hash: Math.random().toString(36).slice(2, 12) },
    { id: `ev-${plate}-invoice`, file_name: `${invoiceId}.png`, storage_path: sampleImage("invoice", plate), content_type: "image/png", uploaded_at: gateEntry.toISOString(), file_hash: Math.random().toString(36).slice(2, 12), supplier_name: supplier, invoice_number: invoiceId },
    { id: `ev-${plate}-weigh`, file_name: `${plate}-weighbridge.jpg`, storage_path: sampleImage("weighbridge", plate), content_type: "image/jpeg", uploaded_at: addMinutes(gateEntry, 5).toISOString(), file_hash: Math.random().toString(36).slice(2, 12) },
    { id: `ev-${plate}-unload`, file_name: `${plate}-unload.jpg`, storage_path: sampleImage("unload", plate), content_type: "image/jpeg", uploaded_at: unloadAt.toISOString(), file_hash: Math.random().toString(36).slice(2, 12) },
    { id: `ev-${plate}-checkpoint`, file_name: `${plate}-checkpoint.jpg`, storage_path: sampleImage("industrial", plate), content_type: "image/jpeg", uploaded_at: operatorAt.toISOString(), file_hash: Math.random().toString(36).slice(2, 12) }
  ];

  return {
    id: `${format(date, "yyyyMMdd")}-${idx}`,
    occurred_at: date.toISOString(),
    delivery_timestamp: date.toISOString(),
    gate_entry_timestamp: gateEntry.toISOString(),
    unload_completion_timestamp: unloadAt.toISOString(),
    invoice_upload_timestamp: gateEntry.toISOString(),
    operator_verification_timestamp: operatorAt.toISOString(),
    vehicle_plate: plate,
    supplier,
    material,
    project_name: project,
    site_name: site,
    invoice_id: invoiceId,
    expected_quantity: expected,
    detected_quantity: net,
    confidence,
    state: anomaly ? "FLAGGED" : "VERIFIED",
    ai_verification: {
      anpr_confidence: Number((confidence - 0.04).toFixed(2)),
      ocr_confidence: Number((confidence - 0.02).toFixed(2)),
      material_verification_confidence: Number((confidence - 0.05).toFixed(2)),
      weighbridge_confidence: Number((confidence + 0.01).toFixed(2)),
      anomaly_probability: anomalyProbability,
      reasoning_summary: anomaly ? "Quantity deviation exceeds expected tolerance." : "Cross-modality checks aligned within tolerance."
    },
    weighbridge: {
      gross_weight: gross,
      tare_weight: tare,
      calculated_net_quantity: net,
      expected_invoice_quantity: expected,
      quantity_difference: diff,
      verification_result: anomaly ? "MISMATCH" : "MATCH"
    },
    anomaly_data: anomaly
      ? {
          anomaly_type: "quantity_mismatch",
          anomaly_severity: Math.abs(diff) > 3 ? "high" : "medium",
          operational_explanation: "Observed net quantity differs from invoice declaration.",
          escalation_state: "operator_review",
          operator_response: "Flagged for manual review",
          investigation_status: "open"
        }
      : null,
    verification_results: [
      { id: `vr-${idx}-1`, analyzer: "Invoice Uploaded", confidence: 1, reasoning: invoiceId },
      { id: `vr-${idx}-2`, analyzer: "ANPR Verified", confidence: Number((confidence - 0.04).toFixed(2)), reasoning: plate },
      { id: `vr-${idx}-3`, analyzer: "Gross Weight Captured", confidence: 0.9, reasoning: `${gross} t` },
      { id: `vr-${idx}-4`, analyzer: "Unload Completed", confidence: 0.95, reasoning: format(unloadAt, "HH:mm:ss") },
      { id: `vr-${idx}-5`, analyzer: "Tare Weight Captured", confidence: 0.9, reasoning: `${tare} t` },
      { id: `vr-${idx}-6`, analyzer: "Quantity Compared", confidence: 0.9, reasoning: `Δ ${diff.toFixed(2)} t` },
      { id: `vr-${idx}-7`, analyzer: "Verification Locked", confidence: 0.96, reasoning: anomaly ? "FLAGGED" : "VERIFIED" },
      { id: `vr-${idx}-8`, analyzer: "Audit Stored", confidence: 0.99, reasoning: `audit/${format(date, "yyyyMMdd")}/${plate}` }
    ],
    evidence
  };
};

const buildDays = (count = 5) => {
  const days: Array<{ date: Date; deliveries: Delivery[] }> = [];
  for (let i = 0; i < count; i++) {
    const date = subDays(new Date(), i);
    const num = random(14, 30);
    const deliveries: Delivery[] = [];
    let minute = 7 * 60;
    for (let j = 0; j < num; j++) {
      const dt = addMinutes(date, minute + random(0, 35));
      deliveries.push(makeDelivery(dt, j));
      minute += random(8, 30);
    }
    days.push({ date, deliveries });
  }
  return days;
};

const stageLabels = [
  "Invoice Uploaded",
  "ANPR Verified",
  "Gross Weight Captured",
  "Unload Completed",
  "Tare Weight Captured",
  "Quantity Compared",
  "Verification Locked",
  "Audit Stored"
];

const ForensicTimeline = ({ delivery }: { delivery?: Delivery | null }) => {
  const [days, setDays] = useState(() => buildDays(6));
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(delivery || null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [verificationIndex, setVerificationIndex] = useState<number | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [invoiceSelected, setInvoiceSelected] = useState<any | null>(null);
  const [activeQueue, setActiveQueue] = useState<QueueItem[]>([]);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [queuePulseId, setQueuePulseId] = useState<string | null>(null);
  const [queueBeat, setQueueBeat] = useState(0);
  const playRef = useRef<number | null>(null);
  const queueBeatRef = useRef<number | null>(null);

  const upsertQueue = useCallback((item: QueueItem) => {
    setActiveQueue((prev) => {
      const idx = prev.findIndex((x) => x.id === item.id);
      const next = [...prev];
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...item };
        const moved = next.splice(idx, 1)[0];
        next.unshift(moved);
      } else {
        next.unshift(item);
      }
      return next.slice(0, 10);
    });
  }, []);

  const handleStreamEvent = useCallback((evt: any) => {
    if (!evt) return;

    if (evt.type === "arrival") {
      const arrivalDate = new Date(evt.occurred_at);
      const gateEntry = addMinutes(arrivalDate, random(1, 5));
      const d = {
        id: evt.id,
        occurred_at: evt.occurred_at,
        delivery_timestamp: evt.occurred_at,
        gate_entry_timestamp: gateEntry.toISOString(),
        unload_completion_timestamp: null,
        invoice_upload_timestamp: null,
        operator_verification_timestamp: null,
        vehicle_plate: evt.vehicle_plate,
        supplier: evt.supplier,
        material: evt.material,
        project_name: evt.project,
        site_name: evt.site,
        invoice_id: evt.invoice_id,
        expected_quantity: evt.expected_quantity,
        detected_quantity: null,
        confidence: null,
        state: "DETECTED",
        ai_verification: null,
        weighbridge: null,
        anomaly_data: null,
        evidence: [
          { id: `${evt.id}-truck`, file_name: `${evt.vehicle_plate}-arrival.jpg`, storage_path: sampleImage("truck", evt.vehicle_plate), content_type: "image/jpeg", uploaded_at: evt.occurred_at, file_hash: Math.random().toString(36).slice(2, 12) }
        ],
        verification_results: [{ id: `${evt.id}-detected`, analyzer: "Detected", confidence: 0.9, reasoning: "Delivery event ingested" }]
      };

      setDays((prev) => {
        const copy = JSON.parse(JSON.stringify(prev));
        const todayKey = format(new Date(evt.occurred_at), "yyyy-MM-dd");
        let day = copy.find((dd: any) => format(dd.date, "yyyy-MM-dd") === todayKey);
        if (!day) {
          day = { date: new Date(evt.occurred_at), deliveries: [] };
          copy.unshift(day);
        }
        day.deliveries.unshift(d);
        return copy;
      });
      setExpandedDay(format(new Date(evt.occurred_at), "yyyy-MM-dd"));
      setPulseId(evt.id);
      setQueuePulseId(evt.id);
      setTimeout(() => setPulseId(null), 1200);
      setTimeout(() => setQueuePulseId(null), 1800);
      upsertQueue({ id: evt.id, plate: evt.vehicle_plate, supplier: evt.supplier, state: "detected", updatedAt: evt.occurred_at });
      return;
    }

    setDays((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      for (const day of copy) {
        const idx = day.deliveries.findIndex((dd: any) => dd.id === evt.id || dd.invoice_id === evt.invoice_id);
        if (idx < 0) continue;
        const d = day.deliveries[idx];

        if (evt.type === "anpr") {
          d.evidence.push({ id: `${d.id}-anpr`, file_name: `${d.vehicle_plate}-anpr.jpg`, storage_path: sampleImage("anpr", d.vehicle_plate), content_type: "image/jpeg", uploaded_at: evt.occurred_at, file_hash: Math.random().toString(36).slice(2, 12) });
          d.verification_results.push({ id: `${d.id}-anpr`, analyzer: "ANPR Verified", confidence: evt.anpr_confidence, reasoning: d.vehicle_plate });
          d.state = "processing";
          setQueuePulseId(d.id);
          upsertQueue({ id: d.id, plate: d.vehicle_plate, supplier: d.supplier, state: "processing", updatedAt: new Date().toISOString() });
        }

        if (evt.type === "weighbridge") {
          const gross = Number(evt.gross ?? 0);
          const tare = Number(evt.tare ?? 0);
          const net = Number((gross - tare).toFixed(2));
          const expected = Number(d.expected_quantity ?? 0);
          const diff = Number((expected - net).toFixed(2));
          d.evidence.push({ id: `${d.id}-wb`, file_name: `${d.vehicle_plate}-weighbridge.jpg`, storage_path: sampleImage("weighbridge", d.vehicle_plate), content_type: "image/jpeg", uploaded_at: evt.occurred_at, file_hash: Math.random().toString(36).slice(2, 12) });
          d.weighbridge = {
            gross_weight: gross,
            tare_weight: tare,
            calculated_net_quantity: net,
            expected_invoice_quantity: expected,
            quantity_difference: diff,
            verification_result: Math.abs(diff) > 1.3 ? "MISMATCH" : "MATCH"
          };
          d.detected_quantity = net;
          d.verification_results.push({ id: `${d.id}-gross`, analyzer: "Gross Weight Captured", confidence: 0.9, reasoning: `${gross} t` });
          d.verification_results.push({ id: `${d.id}-tare`, analyzer: "Tare Weight Captured", confidence: 0.9, reasoning: `${tare} t` });
          d.verification_results.push({ id: `${d.id}-comp`, analyzer: "Quantity Compared", confidence: 0.9, reasoning: `Δ ${diff.toFixed(2)} t` });
          setQueuePulseId(d.id);
          upsertQueue({ id: d.id, plate: d.vehicle_plate, supplier: d.supplier, state: "weighbridge_pending", updatedAt: new Date().toISOString() });
        }

        if (evt.type === "invoice_uploaded") {
          d.evidence.push({ id: `${d.id}-inv`, file_name: `${evt.invoice_id}.png`, storage_path: sampleImage("invoice", d.vehicle_plate), content_type: "image/png", uploaded_at: evt.occurred_at, file_hash: Math.random().toString(36).slice(2, 12), supplier_name: d.supplier, invoice_number: evt.invoice_id });
          d.invoice_upload_timestamp = evt.occurred_at;
          d.verification_results.push({ id: `${d.id}-invoice`, analyzer: "Invoice Uploaded", confidence: 1, reasoning: evt.invoice_id });
          d.verification_results.push({ id: `${d.id}-ocr`, analyzer: "OCR Extraction", confidence: evt.ocr_confidence, reasoning: "Invoice fields extracted" });
          setQueuePulseId(d.id);
          upsertQueue({ id: d.id, plate: d.vehicle_plate, supplier: d.supplier, state: "invoice_matched", updatedAt: new Date().toISOString() });
        }

        if (evt.type === "verification_step") {
          d.verification_results.push({ id: `${d.id}-step-${evt.step_index}`, analyzer: `Stage`, confidence: 0.85, reasoning: evt.step.replace(/_/g, " ") });
          d.state = evt.step;
          setQueuePulseId(d.id);
          upsertQueue({ id: d.id, plate: d.vehicle_plate, supplier: d.supplier, state: evt.step, updatedAt: new Date().toISOString() });
        }

        if (evt.type === "anomaly_alert") {
          d.anomaly_data = {
            anomaly_type: evt.anomaly_type,
            anomaly_severity: evt.severity,
            operational_explanation: evt.explanation,
            escalation_state: "escalated",
            operator_response: "Review initiated",
            investigation_status: "open"
          };
          d.state = "FLAGGED";
          setQueuePulseId(d.id);
          upsertQueue({ id: d.id, plate: d.vehicle_plate, supplier: d.supplier, state: "escalated", alert: evt.anomaly_type, updatedAt: new Date().toISOString() });
        }

        if (evt.type === "operator_action") {
          d.operator_verification_timestamp = new Date().toISOString();
          d.verification_results.push({ id: `${d.id}-operator`, analyzer: "Operator Review", confidence: 0.95, reasoning: evt.action });
          setQueuePulseId(d.id);
          upsertQueue({ id: d.id, plate: d.vehicle_plate, supplier: d.supplier, state: "operator_review", updatedAt: new Date().toISOString() });
        }

        if (evt.type === "verification_complete") {
          d.state = evt.result;
          d.verification_results.push({ id: `${d.id}-lock`, analyzer: "Verification Locked", confidence: 0.97, reasoning: evt.result });
          d.verification_results.push({ id: `${d.id}-audit`, analyzer: "Audit Stored", confidence: 0.99, reasoning: `audit/${format(new Date(), "yyyyMMdd")}/${d.vehicle_plate}` });
          setQueuePulseId(d.id);
          upsertQueue({ id: d.id, plate: d.vehicle_plate, supplier: d.supplier, state: evt.result.toLowerCase(), updatedAt: new Date().toISOString() });
        }

        day.deliveries.splice(idx, 1);
        day.deliveries.unshift(d);
        break;
      }
      return copy;
    });
  }, [upsertQueue]);

  useOpsStream(handleStreamEvent, { seed: 1337, enabled: true });

  useEffect(() => {
    if (!autoPlay || !expandedDay) return;
    playRef.current = window.setInterval(() => {
      setVerificationIndex((v) => (v == null ? 0 : v + 1));
    }, 1300);
    return () => {
      if (playRef.current) window.clearInterval(playRef.current);
    };
  }, [autoPlay, expandedDay]);

  useEffect(() => {
    queueBeatRef.current = window.setInterval(() => {
      setQueueBeat((x) => (x + 1) % 10000);
    }, 4200);
    return () => {
      if (queueBeatRef.current) window.clearInterval(queueBeatRef.current);
    };
  }, []);

  const openForDelivery = (d: Delivery) => {
    setSelectedDelivery(d);
    setSelectedEvidenceId(d.evidence?.[0]?.id || null);
    setVerificationIndex(null);
  };

  const openInvoice = (inv: any) => {
    if (!inv) return;
    setInvoiceSelected(inv);
    setInvoicePreview(inv.storage_path || null);
    setInvoiceModalOpen(true);
  };

  const activeEvidence = useMemo(() => {
    if (!selectedDelivery?.evidence?.length) return null;
    return selectedDelivery.evidence.find((e: any) => e.id === selectedEvidenceId) || selectedDelivery.evidence[0];
  }, [selectedDelivery, selectedEvidenceId]);

  const stageProgress = (d: Delivery) => {
    const analyzers = new Set((d.verification_results || []).map((x: any) => String(x.analyzer)));
    return stageLabels.map((label) => {
      let complete = analyzers.has(label);
      if (label === "Invoice Uploaded") complete = complete || !!d.invoice_upload_timestamp;
      if (label === "ANPR Verified") complete = complete || analyzers.has("ANPR Verified");
      if (label === "Gross Weight Captured") complete = complete || !!d.weighbridge?.gross_weight;
      if (label === "Unload Completed") complete = complete || !!d.unload_completion_timestamp;
      if (label === "Tare Weight Captured") complete = complete || !!d.weighbridge?.tare_weight;
      if (label === "Quantity Compared") complete = complete || d.weighbridge?.verification_result != null;
      if (label === "Verification Locked") complete = complete || ["VERIFIED", "FLAGGED"].includes(String(d.state).toUpperCase());
      if (label === "Audit Stored") complete = complete || analyzers.has("Audit Stored");
      return { label, complete };
    });
  };

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Forensic timeline</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Infrastructure Delivery Reconstruction Engine</h2>
            <p className="text-xs text-slate-400">Realtime ingest, verification chain replay, evidence-rich investigation workspace.</p>
          </div>
          <button onClick={() => setAutoPlay((v) => !v)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
            {autoPlay ? "Pause replay" : "Resume replay"}
          </button>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {days.map((day) => {
            const key = format(day.date, "yyyy-MM-dd");
            const expanded = expandedDay === key;
            const anomalies = day.deliveries.filter((d) => String(d.state).toUpperCase().includes("FLAG")).length;
            const suppliersCount = Array.from(new Set(day.deliveries.map((d) => d.supplier))).length;
            const total = day.deliveries.reduce((s, d) => s + Number(d.detected_quantity || 0), 0);

            return (
              <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/70">
                <div className="flex items-start justify-between px-3 py-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{format(day.date, "dd LLL yyyy").toUpperCase()}</p>
                    <p className="text-sm text-white">{day.deliveries.length} deliveries · {anomalies} anomalies · {suppliersCount} suppliers · {total.toFixed(1)} t</p>
                  </div>
                  <button onClick={() => setExpandedDay(expanded ? null : key)} className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-cyan-200">{expanded ? "Collapse" : "Expand"}</button>
                </div>

                {expanded ? (
                  <div className="border-t border-white/10 px-2 py-2">
                    <div className="space-y-1">
                      {day.deliveries.map((d: Delivery) => {
                        const highlight = pulseId === d.id;
                        return (
                          <div key={d.id} className={`rounded-xl border px-2 py-2 transition-all duration-300 ${highlight ? "border-cyan-400/60 bg-cyan-500/10 tactical-glow" : "border-white/10 bg-white/5"}`}>
                            <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-2">
                              <img src={d.evidence?.[0]?.storage_path || sampleImage("truck", d.vehicle_plate)} alt="arrival" className="h-12 w-20 rounded-md object-cover" />
                              <div className="min-w-0">
                                <p className="truncate text-xs text-white">{d.vehicle_plate} · {d.supplier} · {d.material} · {d.project_name}</p>
                                <p className="truncate text-[11px] text-slate-400">{format(new Date(d.occurred_at), "HH:mm:ss")} · {d.site_name} · Invoice {d.invoice_id} · Net {d.detected_quantity ?? "--"} t · Δ {d.weighbridge?.quantity_difference ?? "--"}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => openForDelivery(d)} className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300">Open</button>
                                <button onClick={() => openInvoice(d.evidence.find((e: any) => String(e.content_type).includes("png")))} className="rounded border border-white/10 px-2 py-1 text-[11px] text-cyan-200">Invoice</button>
                                <span className={`rounded px-2 py-1 text-[10px] ${String(d.state).toUpperCase().includes("FLAG") ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200"}`}>{String(d.state).toUpperCase()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <aside className="sticky top-3 h-fit rounded-2xl border border-white/10 bg-slate-950/85 p-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Active verification queue</p>
          <div className="mt-2 space-y-1">
            {activeQueue.length === 0 ? <p className="text-xs text-slate-400">Waiting for ingest events...</p> : null}
            {activeQueue.map((q, qi) => (
              <div key={q.id} className={`rounded-lg border border-white/10 bg-white/5 px-2 py-2 transition-all duration-300 ${queuePulseId === q.id ? "tactical-glow" : ""} ${qi === (queueBeat % Math.max(activeQueue.length, 1)) ? "queue-pulse" : ""}`}>
                <p className="truncate text-xs text-white">{q.plate} · {q.supplier}</p>
                <p className="text-[11px] text-slate-400">{q.state.replace(/_/g, " ")} · {format(new Date(q.updatedAt), "HH:mm:ss")}</p>
                {q.alert ? <p className="text-[11px] text-rose-300">alert: {q.alert}</p> : null}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {selectedDelivery ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/90 p-3">
          <div className="mx-auto grid w-full max-w-[1500px] gap-3 rounded-2xl border border-white/10 bg-slate-950/95 p-3 lg:grid-cols-[1.3fr_1fr_0.8fr]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Evidence workspace</p>
                <button onClick={() => setSelectedDelivery(null)} className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300">Close</button>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 transition-all duration-300 hover:border-cyan-400/35 hover:shadow-[0_18px_45px_rgba(8,24,34,0.55)]">
                {activeEvidence ? (
                  <img src={activeEvidence.storage_path} alt={activeEvidence.file_name} className="h-[320px] w-full object-cover transition-transform duration-500 hover:scale-[1.015]" />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-xs text-slate-500">No evidence selected</div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(selectedDelivery.evidence || []).map((ev: any) => (
                  <button key={ev.id} onClick={() => setSelectedEvidenceId(ev.id)} className={`overflow-hidden rounded border transition-all duration-300 ${selectedEvidenceId === ev.id ? "border-cyan-400/60 ring-1 ring-cyan-400/35" : "border-white/10 hover:border-cyan-400/35"}`}>
                    <img src={ev.storage_path} alt={ev.file_name} className={`h-16 w-full object-cover transition-transform duration-300 ${selectedEvidenceId === ev.id ? "scale-[1.03]" : "hover:scale-[1.02]"}`} />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(selectedDelivery.evidence || []).slice(0, 4).map((ev: any) => (
                  <EvidenceCard key={ev.id} evidence={ev} onOpen={() => setSelectedEvidenceId(ev.id)} />
                ))}
              </div>
            </div>

            <div className="space-y-2 border-x border-white/10 px-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Verification chain</p>
              <div className="space-y-1">
                {stageProgress(selectedDelivery).map((stage, i, arr) => {
                  const active = verificationIndex != null && (verificationIndex % arr.length) === i;
                  return (
                  <div key={stage.label} className={`relative rounded-lg border border-white/10 bg-white/5 px-2 py-2 transition-all duration-300 ${stage.complete ? "stage-flow" : ""} ${active ? "tactical-glow border-cyan-400/45" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${active ? "bg-cyan-300 pulse-ring" : stage.complete ? "bg-emerald-400" : "bg-slate-500"}`} />
                      <span className={`text-xs transition-colors duration-300 ${active ? "text-cyan-100" : stage.complete ? "text-slate-100" : "text-slate-400"}`}>{stage.label}</span>
                    </div>
                    {i < arr.length - 1 ? <div className="ml-1 mt-1 h-3 border-l border-dashed border-white/20" /> : null}
                  </div>
                );})}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Operational metadata</p>
              <div className="space-y-1 text-[11px] text-slate-300">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Truck: {selectedDelivery.vehicle_plate}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Supplier: {selectedDelivery.supplier}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Project: {selectedDelivery.project_name}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Site: {selectedDelivery.site_name}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Delivery: {format(new Date(selectedDelivery.delivery_timestamp || selectedDelivery.occurred_at), "yyyy-MM-dd HH:mm:ss")}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Gate Entry: {selectedDelivery.gate_entry_timestamp ? format(new Date(selectedDelivery.gate_entry_timestamp), "yyyy-MM-dd HH:mm:ss") : "--"}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Unload Completed: {selectedDelivery.unload_completion_timestamp ? format(new Date(selectedDelivery.unload_completion_timestamp), "yyyy-MM-dd HH:mm:ss") : "--"}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Invoice Uploaded: {selectedDelivery.invoice_upload_timestamp ? format(new Date(selectedDelivery.invoice_upload_timestamp), "yyyy-MM-dd HH:mm:ss") : "--"}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Operator Verification: {selectedDelivery.operator_verification_timestamp ? format(new Date(selectedDelivery.operator_verification_timestamp), "yyyy-MM-dd HH:mm:ss") : "--"}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">ANPR / OCR / Material / WB: {selectedDelivery.ai_verification ? `${selectedDelivery.ai_verification.anpr_confidence} / ${selectedDelivery.ai_verification.ocr_confidence} / ${selectedDelivery.ai_verification.material_verification_confidence} / ${selectedDelivery.ai_verification.weighbridge_confidence}` : "streaming"}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Gross / Tare / Net / Expected / Δ: {selectedDelivery.weighbridge ? `${selectedDelivery.weighbridge.gross_weight} / ${selectedDelivery.weighbridge.tare_weight} / ${selectedDelivery.weighbridge.calculated_net_quantity} / ${selectedDelivery.weighbridge.expected_invoice_quantity} / ${selectedDelivery.weighbridge.quantity_difference}` : "streaming"}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Anomaly: {selectedDelivery.anomaly_data ? `${selectedDelivery.anomaly_data.anomaly_type} (${selectedDelivery.anomaly_data.anomaly_severity})` : "none"}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">Investigation: {selectedDelivery.anomaly_data?.investigation_status || "closed"}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <InvoiceEvidenceModal open={invoiceModalOpen} invoice={invoiceSelected} previewUrl={invoicePreview} onClose={() => setInvoiceModalOpen(false)} />
    </div>
  );
};

export default ForensicTimeline;
