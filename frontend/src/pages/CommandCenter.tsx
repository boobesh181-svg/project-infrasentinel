import OperationsLayout from "../components/layout/OperationsLayout";
import { useEffect, useMemo, useRef, useState } from "react";
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

const randomPlate = () => `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
const randomSupplier = () => ["Acme", "NorthCo", "Pioneer", "Harbor Ltd."][Math.floor(Math.random() * 4)];
const randomMaterial = () => ["Gravel", "Sand", "Aggregate", "Soil"][Math.floor(Math.random() * 4)];

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

const CommandCenter = () => {
  const [events, setEvents] = useState<LiveEvent[]>(() => Array.from({ length: 6 }, makeEvent));
  const [ingestCount, setIngestCount] = useState(0);
  const streamRef = useRef<number | null>(null);

  useEffect(() => {
    // Simulated live stream that inserts new events and ages the list
    streamRef.current = window.setInterval(() => {
      const next = makeEvent();
      setEvents((prev) => [next, ...prev].slice(0, 12));
      setIngestCount((c) => c + 1);
    }, 2500);
    return () => {
      if (streamRef.current) window.clearInterval(streamRef.current);
    };
  }, []);

  const anomalyCount = useMemo(() => events.filter((e) => e.anomaly).length, [events]);
  const reviewCount = useMemo(() => Math.max(0, events.length - anomalyCount - 2), [events.length, anomalyCount]);
  const latestEvent = events[0];
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
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="border border-white/10 bg-slate-950/65 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Live activity feed</p>
                <p className="mt-1 text-sm text-slate-300">Streaming arrivals, confidence shifts, and anomaly flags.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                synchronized live stream
              </div>
            </div>
            <div className="mt-3 max-h-[520px] overflow-auto px-2">
              {events.map((ev) => (
                <div key={ev.id} className="group relative mb-2 flex items-center gap-3 border border-white/8 bg-slate-950/60 p-2 transition hover:border-cyan-400/20">
                  <div className="h-14 w-24 overflow-hidden border border-white/10 bg-slate-900/70">
                    <img src={ev.image} alt="truck" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{ev.plate}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{ev.supplier} · {ev.material}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{new Date(ev.time).toLocaleTimeString()}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 w-14 overflow-hidden bg-white/6">
                            <div className={`h-full ${ev.confidence > 0.8 ? 'bg-emerald-400' : ev.confidence > 0.6 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.round(ev.confidence * 100)}%` }} />
                          </div>
                          <span className="text-xs text-slate-300">{Math.round(ev.confidence * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span className={`inline-block h-2 w-2 rounded-full ${ev.anomaly ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                      <span>{ev.anomaly ? 'anomaly detected' : 'processing'}</span>
                      <span className="mx-1">•</span>
                      <span>weighbridge lane 3</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-3">
            <div className="border border-white/10 bg-slate-950/65 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Verification queue</p>
                  <p className="mt-1 text-sm text-slate-300">Operator assignment and review progress.</p>
                </div>
                <ShieldAlert className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 border border-white/10 bg-white/4 px-2 py-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 border border-white/10 bg-white/6 pulse-ring" />
                      <div className="text-sm">
                        <div className="text-sm font-medium text-white">{randomPlate()}</div>
                        <div className="text-xs text-slate-400">{randomSupplier()}</div>
                      </div>
                    </div>
                    <div className="w-24">
                      <div className="h-2 w-full rounded-full bg-white/6">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${20 + i * 18}%` }} />
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
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Invoice queue</p>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between border border-white/10 bg-white/4 px-2 py-2">
                  <div>Pending</div>
                  <div>12</div>
                </div>
                <div className="flex items-center justify-between border border-white/10 bg-white/4 px-2 py-2">
                  <div>Under review</div>
                  <div>3</div>
                </div>
                <div className="flex items-center justify-between border border-white/10 bg-white/4 px-2 py-2">
                  <div>Escalated</div>
                  <div className="text-rose-300">1</div>
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/65 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Latest signal</p>
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
          </aside>
        </div>
      </div>
    </OperationsLayout>
  );
};

export default CommandCenter;
