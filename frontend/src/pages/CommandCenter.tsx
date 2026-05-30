import OperationsLayout from "../components/layout/OperationsLayout";
import { useEffect, useMemo, useRef, useState } from "react";
import { listLocalDeliveries } from "../api/ops";
import { ArrowRight, CheckCircle2, Clock3, ShieldAlert, Waves } from "lucide-react";

const Badge = ({ label }: { label: string }) => (
  <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-300">{label}</span>
);

const Button = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <button className={`rounded-md bg-emerald-500/95 px-3 py-2 text-sm font-medium text-black ${className || ''}`}>{children}</button>
);

type LiveEvent = {
  id: string;
  plate: string;
  supplier: string;
  material: string;
  time: string;
  confidence: number;
  anomaly?: boolean;
  image: string;
};

type QueueItem = LiveEvent & {
  stage: string;
  progress: number;
  etaMinutes: number;
};

type VerificationStep = {
  label: string;
  state: "queued" | "active" | "complete";
  note: string;
};

type WeighbridgeState = {
  label: string;
  value: string;
  tone: string;
};

const randomPlate = () => `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
const randomSupplier = () => ["Acme", "NorthCo", "Pioneer", "Harbor Ltd."][Math.floor(Math.random() * 4)];
const randomMaterial = () => ["Gravel", "Sand", "Aggregate", "Soil"][Math.floor(Math.random() * 4)];
const randomStage = () => ["Gate check", "ANPR match", "Weighbridge", "Invoice sync", "Operator review"][Math.floor(Math.random() * 5)];

const makeEvent = (): LiveEvent => ({
  id: String(Date.now() + Math.floor(Math.random() * 1000)),
  plate: randomPlate(),
  supplier: randomSupplier(),
  material: randomMaterial(),
  time: new Date().toISOString(),
  confidence: Number((0.5 + Math.random() * 0.5).toFixed(2)),
  anomaly: Math.random() > 0.88,
  image: `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/160/100`
});

const makeQueueItem = (): QueueItem => {
  const event = makeEvent();
  return {
    ...event,
    stage: randomStage(),
    progress: Math.round(15 + Math.random() * 75),
    etaMinutes: Math.max(1, Math.round(12 + Math.random() * 38))
  };
};

const buildVerificationSteps = (tick: number): VerificationStep[] => {
  const steps = ["Gate check", "ANPR match", "Weighbridge capture", "Invoice reconciliation", "Operator sign-off"];
  return steps.map((label, index) => {
    const completed = tick % 5 > index;
    const active = tick % 5 === index;
    return {
      label,
      state: completed ? "complete" : active ? "active" : "queued",
      note: completed ? "locked" : active ? "processing" : "waiting"
    };
  });
};

const buildWeighbridgeStates = (latest: QueueItem | undefined): WeighbridgeState[] => [
  { label: "Lane 3", value: latest ? "occupied" : "idle", tone: latest ? "text-emerald-100" : "text-slate-300" },
  { label: "Gross weight", value: latest ? `${(42 + (latest.progress || 0) / 3).toFixed(1)} t` : "--", tone: "text-cyan-100" },
  { label: "Tare lock", value: latest?.anomaly ? "pending review" : "synced", tone: latest?.anomaly ? "text-rose-100" : "text-emerald-100" },
  { label: "Reconcile state", value: latest ? latest.stage : "standby", tone: "text-white" }
];

const progressWidthClass = (value: number) => {
  if (value >= 90) return "w-[90%]";
  if (value >= 75) return "w-3/4";
  if (value >= 60) return "w-2/3";
  if (value >= 50) return "w-1/2";
  if (value >= 35) return "w-1/3";
  if (value >= 25) return "w-1/4";
  return "w-1/5";
};

const CommandCenter = () => {
  const [events, setEvents] = useState<LiveEvent[]>(() => Array.from({ length: 6 }, makeEvent));
  const [truckQueue, setTruckQueue] = useState<QueueItem[]>(() => Array.from({ length: 5 }, makeQueueItem));
  const [escalations, setEscalations] = useState<QueueItem[]>(() => Array.from({ length: 3 }, makeQueueItem));
  const [operatorInterventions, setOperatorInterventions] = useState<string[]>(() => ["Operator assigned to lane 3", "Weighbridge drift under review", "Invoice sync awaiting sign-off"]);
  const [tick, setTick] = useState(0);
  const [ingestCount, setIngestCount] = useState(0);
  const streamRef = useRef<number | null>(null);
  const queueRef = useRef<number | null>(null);
  const pulseRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listLocalDeliveries();
        if (rows && rows.length) {
          const q = rows.map((r: any, idx: number) => ({
            id: r.id,
            plate: r.plate || `TRK-${idx}`,
            supplier: r.supplier || 'Unknown',
            material: r.material || 'Aggregate',
            time: r.time || new Date().toISOString(),
            confidence: Number((r.confidence || 0.85).toFixed(2)),
            anomaly: !!r.anomaly,
            image: `/assets/realistic/truck-arrival-1.jpg`,
            stage: r.state || 'Processing',
            progress: Math.round((r.confidence || 0.8) * 80) + 10,
            etaMinutes: 5 + idx * 3
          }));
          setTruckQueue(q);
          setEscalations(q.filter((x) => x.anomaly).slice(0, 4));
          setEvents(q.slice(0, 6).map((x) => ({ id: x.id, plate: x.plate, supplier: x.supplier, material: x.material, time: x.time, confidence: x.confidence, anomaly: x.anomaly, image: x.image })));
        }
      } catch (e) {
        // ignore
      }
    })();

    streamRef.current = window.setInterval(() => {
      const next = makeEvent();
      setEvents((prev) => [next, ...prev].slice(0, 12));
      setIngestCount((c) => c + 1);
    }, 2500);
    queueRef.current = window.setInterval(() => {
      const next = makeQueueItem();
      setTruckQueue((prev) => [next, ...prev.map((item) => ({ ...item, progress: Math.max(0, item.progress - 4), etaMinutes: Math.max(1, item.etaMinutes - 1) }))].slice(0, 6));
      if (next.anomaly) {
        setEscalations((prev) => [next, ...prev].slice(0, 5));
      }
      setOperatorInterventions((prev) => [`${next.plate} queued for ${next.stage}`, ...prev].slice(0, 4));
    }, 3200);
    pulseRef.current = window.setInterval(() => setTick((t) => t + 1), 1500);
    return () => {
      if (streamRef.current) window.clearInterval(streamRef.current);
      if (queueRef.current) window.clearInterval(queueRef.current);
      if (pulseRef.current) window.clearInterval(pulseRef.current);
    };
  }, []);

  const anomalyCount = useMemo(() => events.filter((e) => e.anomaly).length, [events]);
  const reviewCount = useMemo(() => Math.max(0, events.length - anomalyCount - 2), [events.length, anomalyCount]);
  const latestEvent = events[0];
  const activeQueueItem = truckQueue[0];
  const verificationSteps = useMemo(() => buildVerificationSteps(tick), [tick]);
  const weighbridgeStates = useMemo(() => buildWeighbridgeStates(activeQueueItem), [activeQueueItem]);
  const activeInvestigationQueue = useMemo(() => truckQueue.slice(0, 4), [truckQueue]);
  const missionCards = [
    { label: "Live ingests", value: ingestCount, tone: "text-cyan-100", hint: "streamed into the mission lane" },
    { label: "Queued for review", value: reviewCount, tone: "text-emerald-100", hint: "ready for operator assignment" },
    { label: "Anomalies", value: anomalyCount, tone: "text-rose-100", hint: "flagged for escalation" }
  ];
  const triageRows = [
    { label: "Gate checks", value: `${Math.max(2, events.length - anomalyCount)} passing`, tone: "bg-emerald-500/10 text-emerald-100" },
    { label: "Invoice review", value: `${Math.max(1, anomalyCount)} pending`, tone: "bg-amber-500/10 text-amber-100" },
    { label: "Escalations", value: `${anomalyCount > 0 ? 1 : 0} open`, tone: "bg-rose-500/10 text-rose-100" }
  ];

  return (
    <OperationsLayout kicker="InfraSentinel / Command Center" title="Command Center" badges={["live operations", "active verification"]}>
      <div className="space-y-4">
        <section className="operational-panel px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                <Waves className="h-4 w-4 text-cyan-300" />
                live mission control
                <span className="border border-white/10 bg-white/4 px-3 py-1 text-slate-300">evidence-first triage</span>
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-4xl">Command Center</h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Every ingested vehicle becomes an operational record, every exception is routed to review, and every queue remains visible until an operator closes the loop.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {missionCards.map((card) => (
                <div key={card.label} className="border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
                  <p className={`mt-2 text-3xl font-semibold ${card.tone}`}>{card.value}</p>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">{card.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {triageRows.map((row) => (
              <div key={row.label} className={`border border-white/10 px-3 py-3 ${row.tone}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-inherit/70">{row.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{row.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {[
              { label: "Queue depth", value: truckQueue.length, tone: "text-cyan-100", pulse: true },
              { label: "Active escalations", value: escalations.length, tone: "text-rose-100", pulse: anomalyCount > 0 },
              { label: "Operators engaged", value: Math.max(1, operatorInterventions.length), tone: "text-emerald-100", pulse: true },
              { label: "Verification stage", value: verificationSteps.find((step) => step.state === "active")?.label || "Standby", tone: "text-white", pulse: false }
            ].map((item) => (
              <div key={item.label} className="border border-white/10 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                  <span className={`h-1.5 w-1.5 rounded-full ${item.pulse ? "bg-cyan-300 pulse-ring" : "bg-slate-600"}`} />
                </div>
                <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_0.8fr]">
          <section className="border border-white/10 bg-slate-950/65 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Live truck queue</p>
                <p className="mt-1 text-sm text-slate-300">Insertion, movement, and hold state stay visible in real time.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                synchronized live stream
              </div>
            </div>
            <div className="mt-3 max-h-[520px] overflow-auto px-2">
              {truckQueue.map((item, index) => (
                <div key={item.id} className={`group relative mb-2 flex items-center gap-3 border bg-slate-950/60 p-2 transition hover:border-cyan-400/20 ${index === 0 ? "border-cyan-400/25 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]" : "border-white/8"}`}>
                  <div className="h-14 w-24 overflow-hidden border border-white/10 bg-slate-900/70">
                    <img src={item.image} alt="truck" className="h-full w-full object-cover opacity-90" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.plate}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{item.supplier} · {item.material}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{item.stage}</p>
                        <p className="mt-1 text-xs text-slate-400">ETA {item.etaMinutes} min</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 w-14 overflow-hidden bg-white/6">
                            <div className={`h-full ${progressWidthClass(item.progress)} ${item.confidence > 0.8 ? "bg-emerald-400" : item.confidence > 0.6 ? "bg-amber-400" : "bg-rose-400"}`} />
                          </div>
                          <span className="text-xs text-slate-300">{item.progress}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span className={`inline-block h-2 w-2 rounded-full ${item.anomaly ? "bg-rose-400 pulse-ring" : index === 0 ? "bg-cyan-300 pulse-ring" : "bg-emerald-400"}`} />
                      <span>{item.anomaly ? "anomaly detected" : index === 0 ? "currently moving" : "queued"}</span>
                      <span className="mx-1">•</span>
                      <span>weighbridge lane 3</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="border border-white/10 bg-slate-950/65 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Realtime verification progression</p>
                  <p className="mt-1 text-sm text-slate-300">State advances in the same lane as the queue and operator action.</p>
                </div>
                <Clock3 className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-2">
                {verificationSteps.map((step, index) => (
                  <div key={step.label} className={`flex items-center justify-between gap-3 border px-2 py-2 ${step.state === "active" ? "border-cyan-400/25 bg-cyan-500/10" : step.state === "complete" ? "border-emerald-400/20 bg-emerald-500/10" : "border-white/10 bg-white/4"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 border ${step.state === "active" ? "border-cyan-400/30 bg-cyan-400/10 pulse-ring" : step.state === "complete" ? "border-emerald-400/25 bg-emerald-400/10" : "border-white/10 bg-white/6"}`} />
                      <div>
                        <p className="text-sm font-medium text-white">{step.label}</p>
                        <p className="text-xs text-slate-400">{step.note}</p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/65 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Active anomaly rail</p>
                  <p className="mt-1 text-sm text-slate-300">Flags move forward with the replay rather than sitting as static alerts.</p>
                </div>
                <ShieldAlert className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-2">
                {escalations.slice(0, 4).map((item, i) => (
                  <div key={item.id} className={`flex items-center justify-between gap-3 border px-2 py-2 ${i === 0 ? "border-rose-400/25 bg-rose-500/10" : "border-white/10 bg-white/4"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 border ${i === 0 ? "border-rose-400/30 bg-rose-400/10 pulse-ring" : "border-white/10 bg-white/6"}`} />
                      <div className="text-sm">
                        <div className="text-sm font-medium text-white">{item.plate}</div>
                        <div className="text-xs text-slate-400">{item.supplier} · {item.material}</div>
                      </div>
                    </div>
                    <div className="w-24">
                      <div className="h-2 w-full rounded-full bg-white/6">
                        <div className={`h-full rounded-full ${progressWidthClass(Math.max(20, Math.round(item.confidence * 100)))} ${i === 0 ? "bg-rose-400" : "bg-amber-400"}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button className="w-full">Assign Operator</Button>
                <Button className="w-full bg-slate-900 text-white">Pause Stream</Button>
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/65 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Weighbridge states</p>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                {weighbridgeStates.map((state) => (
                  <div key={state.label} className="flex items-center justify-between border border-white/10 bg-white/4 px-2 py-2">
                    <div>{state.label}</div>
                    <div className={state.tone}>{state.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/65 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Operational escalation feed</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{latestEvent?.plate || "Awaiting stream"}</span>
                  <ArrowRight className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{latestEvent?.supplier || "No supplier"}</span>
                  <span>{latestEvent ? new Date(latestEvent.time).toLocaleTimeString() : "--"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock3 className="h-4 w-4 text-cyan-300" />
                  <span>Next operator assignment queued.</span>
                </div>
                {latestEvent?.anomaly ? (
                  <div className="flex items-center gap-2 border border-rose-400/20 bg-rose-500/10 px-2 py-2 text-xs text-rose-100">
                    <ShieldAlert className="h-4 w-4" />
                    Latest ingest is flagged for escalation review.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border border-emerald-400/20 bg-emerald-500/10 px-2 py-2 text-xs text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    Latest ingest is cleared for operator review.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="border border-white/10 bg-slate-950/65 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Operator interventions</p>
              <div className="mt-3 space-y-2">
                {operatorInterventions.map((entry, index) => (
                  <div key={`${entry}-${index}`} className={`border px-3 py-3 text-sm ${index === 0 ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-50" : "border-white/10 bg-white/4 text-slate-300"}`}>
                    {entry}
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/65 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Active investigation queue</p>
              <div className="mt-3 space-y-2">
                {activeInvestigationQueue.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 border border-white/10 bg-white/4 px-2 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{item.plate}</p>
                      <p className="text-xs text-slate-400">{item.stage}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{new Date(item.time).toLocaleTimeString()}</p>
                      <p className="text-xs text-slate-300">{item.progress}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </OperationsLayout>
  );
};

export default CommandCenter;
