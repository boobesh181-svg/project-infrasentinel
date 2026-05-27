import OperationsLayout from "../components/layout/OperationsLayout";
import { useEffect, useState } from "react";

const Timeline = () => {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    // seed demo events (in real product use websocket)
    setEvents([
      {
        id: "evt-1",
        ts: new Date().toISOString(),
        vehicle: "ABC-123",
        supplier: "Acme Aggregates",
        invoice: "INV-2026-0001",
        gross: 18000,
        tare: 8000,
        net: 10000,
        result: "verified",
        confidence: 0.94
      }
    ]);
  }, []);

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <section className="operational-panel rounded-[32px] px-6 py-6 md:px-7 md:py-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Verification</p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white">Verification Timeline</h1>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{e.vehicle} — {e.supplier}</p>
                  <p className="text-xs text-slate-400">{e.invoice} • {new Date(e.ts).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white">Net: {e.net} kg</p>
                  <p className="text-xs text-slate-400">Confidence: {(e.confidence*100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </OperationsLayout>
  );
};

export default Timeline;
