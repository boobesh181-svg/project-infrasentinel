import OperationsLayout from "../components/layout/OperationsLayout";
import { useEffect, useMemo, useRef, useState } from "react";

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

  return (
    <OperationsLayout>
      <div className="space-y-4">
        <section className="operational-panel rounded-[24px] px-5 py-4 md:px-6 md:py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Operations</p>
              <h2 className="font-display text-xl font-semibold text-white">Command Center</h2>
              <p className="mt-1 text-sm text-slate-300">Realtime operational surface — live ingests, queues, and anomalies.</p>
            </div>
            <div className="flex items-end gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-400">Live ingests</p>
                <div className="mt-1 flex items-center gap-3">
                  <div className="rounded-full bg-white/5 px-3 py-1 text-sm font-semibold text-white">{ingestCount}</div>
                  <div className="text-xs text-slate-400">New / hr</div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Anomalies</p>
                <div className="mt-1">
                  <Badge label={String(anomalyCount)} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[18px] border border-white/10 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between px-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Live Activity Feed</p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                streaming
              </div>
            </div>
            <div className="mt-3 max-h-[520px] overflow-auto px-2">
              {events.map((ev) => (
                <div key={ev.id} className="group relative mb-3 flex items-center gap-3 rounded-xl border border-white/6 bg-gradient-to-r from-slate-900/60 to-slate-950/60 p-2 transition hover:scale-[1.01]">
                  <img src={ev.image} alt="truck" className="h-14 w-24 rounded-md object-cover" />
                  <div className="flex-1 truncate">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{ev.plate}</p>
                        <p className="text-xs text-slate-400">• {ev.supplier}</p>
                        <p className="ml-2 text-xs rounded-full bg-white/3 px-2 py-0.5 text-slate-200">{ev.material}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{new Date(ev.time).toLocaleTimeString()}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className={`h-2 w-12 rounded-full ${ev.confidence > 0.8 ? 'bg-emerald-400' : ev.confidence > 0.6 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.round(ev.confidence*100/10)*10}%` }} />
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
            <div className="rounded-[18px] border border-white/10 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Verification Queue</p>
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-white/6 pulse-ring" />
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
              <div className="mt-3">
                <Button className="w-full">Assign Operator</Button>
              </div>
            </div>

            <div className="rounded-[18px] border border-white/10 bg-slate-950/70 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Invoice Queue</p>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <div>Pending</div>
                  <div>12</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>Under review</div>
                  <div>3</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>Escalated</div>
                  <div className="text-rose-300">1</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </OperationsLayout>
  );
};

export default CommandCenter;
