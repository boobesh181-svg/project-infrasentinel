import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Clock3, Radar, ShieldAlert, Sparkles, Waves } from "lucide-react";
import { motion } from "framer-motion";
import { fetchSites } from "../api/ops";
import OperationsLayout from "../components/layout/OperationsLayout";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useOpsSocket } from "../hooks/useOpsSocket";
import { panelReveal, staggerContainer, staggerItem } from "../animations/variants";

const stageOrder = ["DETECTED", "PROCESSING", "VERIFIED", "FLAGGED", "ESCALATED", "RESOLVED", "ARCHIVED"];

const SitePage = () => {
  const { siteId } = useParams();
  const siteKey = String(siteId || "");
  const [queueCount, setQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liveSignals, setLiveSignals] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchSites();
        setQueueCount(Number(data?.sites?.[siteKey] || 0));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [siteKey]);

  useOpsSocket((payload) => {
    const payloadSite = String(payload.site_id ?? payload.siteId ?? payload.site ?? "");
    if (siteKey && payloadSite && payloadSite !== siteKey) return;

    setLiveSignals((prev) => {
      const next = [
        {
          id: payload.id || `${payload.type || "event"}-${payload.created_at || Date.now()}`,
          ...payload,
          created_at: payload.created_at || new Date().toISOString()
        },
        ...prev
      ];
      return next.slice(0, 10);
    });
  });

  const activeSignal = liveSignals[0];
  const activeState = String(activeSignal?.state || activeSignal?.phase || "DETECTED").toUpperCase();
  const currentStageIndex = Math.max(0, stageOrder.indexOf(activeState));
  const liveCount = liveSignals.length;

  const signalRows = useMemo(
    () =>
      liveSignals.map((signal) => ({
        id: signal.id,
        type: signal.type || "event",
        state: String(signal.state || signal.phase || "").toUpperCase(),
        vehicle_plate: signal.vehicle_plate || "Vehicle",
        supplier: signal.supplier || "Supplier",
        created_at: signal.created_at
      })),
    [liveSignals]
  );

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <motion.section variants={panelReveal} initial="hidden" animate="visible" className="operational-panel px-5 py-5 md:px-6 md:py-6">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Command Center / Site Lane</p>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">Site {siteKey || "—"}</h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-300">
                This lane stays locked to the incoming queue, AI states, evidence capture, and operator escalation for a single site.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={loading ? "SYNCING" : queueCount > 0 ? "SUBMITTED" : "NONE"} />
                <Badge label={activeState} />
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-ring" />
                  lane synced
                </span>
              </div>
            </div>

            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Queue depth", value: loading ? "…" : queueCount },
                { label: "Live signals", value: liveCount },
                { label: "Active state", value: activeState }
              ].map((item) => (
                <motion.div key={item.label} variants={staggerItem} className="border border-white/10 bg-white/4 p-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-7">
            {stageOrder.map((stage, index) => {
              const active = index <= currentStageIndex;
              const current = index === currentStageIndex;
              return (
                <div
                  key={stage}
                  className={`rounded-2xl border px-3 py-3 text-center text-[11px] uppercase tracking-[0.22em] transition ${
                    active ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-950/40 text-slate-500"
                  } ${current ? "shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_22px_rgba(34,211,238,0.15)]" : ""}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-current" : "bg-slate-600"} ${current ? "animate-pulse" : ""}`} />
                    <span>{stage}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <motion.div variants={panelReveal} initial="hidden" animate="visible">
            <Card title="Verification Queue" subtitle="One row equals one incident awaiting operator attention.">
              <div className="mb-4 flex items-center gap-3">
                <input
                  className="w-full rounded-full border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  placeholder="Filter by plate"
                  readOnly
                  value={siteKey}
                />
                <Button variant="secondary" size="md">
                  Filter
                </Button>
              </div>

              <div className="space-y-3">
                {signalRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-400">
                    No queued deliveries. The site is quiet.
                  </div>
                ) : (
                  signalRows.map((item) => (
                    <div key={item.id} className="border border-white/10 bg-white/4 p-3 transition hover:border-cyan-400/25 hover:bg-cyan-500/8">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge label={item.state || item.type.toUpperCase()} />
                            <Badge label={item.vehicle_plate} />
                          </div>
                          <h3 className="mt-3 text-lg font-semibold text-white">{item.supplier || "Unknown supplier"}</h3>
                          <p className="mt-1 text-sm text-slate-400">Recent event from this lane.</p>
                        </div>
                        <ShieldAlert className="h-5 w-5 text-amber-300" />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Link to={`/app/command-center/delivery/${item.id}`} className="inline-flex items-center gap-2 text-sm text-cyan-200">
                          Open verification <ArrowRight className="h-4 w-4" />
                        </Link>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : "Live"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>

          <div className="space-y-6">
            <motion.div variants={panelReveal} initial="hidden" animate="visible">
              <Card title="Live Site Pulse" subtitle="Recent websocket signals from this lane.">
                <div className="space-y-3">
                  {liveSignals.length ? (
                    signalRows.map((signal) => (
                      <div key={`${signal.id}`} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <Radar className="h-4 w-4 text-cyan-300" />
                            <span className="font-medium text-white">{signal.type}</span>
                          </div>
                          {signal.state ? <Badge label={signal.state} /> : null}
                          <span className="text-xs text-slate-500">
                            {signal.created_at ? new Date(signal.created_at).toLocaleTimeString() : "live"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          {signal.vehicle_plate} · {signal.supplier}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                      Waiting for site events.
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div variants={panelReveal} initial="hidden" animate="visible">
              <Card title="Escalation Path" subtitle="Keep actions simple and deliberate.">
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">1. Review queue row.</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">2. Open delivery verification.</div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">3. Confirm, request review, or escalate.</div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>

        <motion.section variants={panelReveal} initial="hidden" animate="visible">
          <Card title="Lane Narrative" subtitle="A compact operational summary of the current site.">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Active state</p>
                <p className="mt-2 inline-flex items-center gap-2 text-white">
                  <Waves className="h-4 w-4 text-cyan-300" />
                  {activeState}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Latest signal</p>
                <p className="mt-2 text-white">{activeSignal?.vehicle_plate || activeSignal?.type || "Awaiting event"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Updated</p>
                <p className="mt-2 inline-flex items-center gap-2 text-white">
                  <Clock3 className="h-4 w-4 text-cyan-300" />
                  {activeSignal?.created_at ? new Date(activeSignal.created_at).toLocaleTimeString() : "Live"}
                </p>
              </div>
            </div>
          </Card>
        </motion.section>
      </div>
    </OperationsLayout>
  );
};

export default SitePage;
