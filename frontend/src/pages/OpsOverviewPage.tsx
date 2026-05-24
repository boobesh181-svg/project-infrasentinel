import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Clock3, Radar, RadioTower, ShieldAlert, Sparkles, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchSites } from "../api/ops";
import OperationsLayout from "../components/layout/OperationsLayout";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { useOpsSocket } from "../hooks/useOpsSocket";
import { motion } from "framer-motion";
import { panelReveal, softPulse, staggerContainer, staggerItem } from "../animations/variants";

const stageOrder = ["DETECTED", "PROCESSING", "VERIFIED", "FLAGGED", "ESCALATED", "RESOLVED", "ARCHIVED"];

const OpsOverviewPage = () => {
  const [sites, setSites] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchSites();
        setSites(data.sites || {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useOpsSocket((payload) => {
    setRecentEvents((prev) => {
      const next = [
        {
          id: payload.id || `${payload.type}-${payload.created_at || Date.now()}`,
          ...payload,
          created_at: payload.created_at || new Date().toISOString()
        },
        ...prev
      ];
      return next.slice(0, 8);
    });
  });

  const totalSites = Object.keys(sites).length;
  const totalQueue = useMemo(() => Object.values(sites).reduce((sum, count) => sum + count, 0), [sites]);
  const lastSignal = recentEvents[0];
  const activeState = String(lastSignal?.state || lastSignal?.phase || "DETECTED").toUpperCase();
  const currentStageIndex = Math.max(0, stageOrder.indexOf(activeState));
  const siteEntries = useMemo(
    () =>
      Object.entries(sites)
        .map(([siteId, count]) => ({ siteId, count }))
        .sort((left, right) => right.count - left.count),
    [sites]
  );
  const escalationEvents = useMemo(
    () =>
      recentEvents.filter((event) => {
        const state = String(event.state || event.phase || "").toUpperCase();
        return ["FLAGGED", "ESCALATED", "REVIEW", "REJECTED"].includes(state) || event.type === "operator_action";
      }),
    [recentEvents]
  );
  const operatorCount = useMemo(
    () => recentEvents.filter((event) => event.type === "operator_action").length,
    [recentEvents]
  );

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <motion.section
          variants={panelReveal}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="operational-panel rounded-[32px] px-6 py-6 md:px-7 md:py-7"
        >
          <div className="scanline" aria-hidden="true" />
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-slate-400">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                live command surface
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">mission critical</span>
              </div>
              <div className="max-w-4xl space-y-4">
                <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
                  Infrastructure verification, rendered as a live intelligence console.
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  Every delivery is treated as an incident, every incident preserves evidence, and every state transition remains visible in real time.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Open replay</Button>
                <Button variant="secondary">Inspect live queue</Button>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-ring" />
                  websocket active
                </span>
              </div>
            </div>

            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Sites", value: loading ? "…" : totalSites, tone: "text-cyan-100" },
                { label: "Queued", value: loading ? "…" : totalQueue, tone: "text-emerald-100" },
                { label: "Signals", value: recentEvents.length, tone: "text-white" }
              ].map((item) => (
                <motion.div key={item.label} variants={staggerItem} className="rounded-[22px] border border-white/10 bg-white/5 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.2)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className={`mt-3 text-3xl font-semibold ${item.tone}`}>{item.value}</p>
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400/80 via-sky-400/60 to-emerald-400/80" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Badge label="INGEST ACTIVE" />
            <Badge label="AI PROCESSING" />
            <Badge label="EVIDENCE READY" />
            <Badge label={activeState} />
            <Badge label={`OPERATORS ${operatorCount}`} />
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
                  <p className="mt-2 text-[10px] tracking-[0.18em] text-slate-300/70">
                    {active ? (current ? "current" : "completed") : "queued"}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.16fr_0.92fr]">
          <motion.div variants={panelReveal} initial="hidden" animate="visible">
            <Card title="Live Site Feeds" subtitle="Camera ingestion and vehicle detections flowing by site.">
              <div className="space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">Loading sites…</div>
                ) : siteEntries.length ? (
                  siteEntries.map(({ siteId, count }) => (
                    <Link
                      key={siteId}
                      to={`/app/command-center/site/${siteId}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-cyan-500/10"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">Site {siteId}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-500">verification lane</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-white">{count}</p>
                        <p className="mt-1 text-xs text-slate-400">active records</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                    No active sites in queue.
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={panelReveal} initial="hidden" animate="visible">
            <Card title="Operational Focus" subtitle="The current verification workflow remains centered and visible.">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">active state</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Badge label={activeState} />
                      <span className="text-sm text-slate-300">{lastSignal?.vehicle_plate || "Awaiting vehicle"}</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                    <Waves className="h-4 w-4 text-cyan-300" />
                    processing core
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">supplier</p>
                    <p className="mt-2 text-sm text-white">{lastSignal?.supplier || "Unknown"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">site</p>
                    <p className="mt-2 text-sm text-white">{lastSignal?.site_id ? String(lastSignal.site_id).slice(0, 8) : "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">updated</p>
                    <p className="mt-2 text-sm text-white">
                      {lastSignal?.created_at ? new Date(lastSignal.created_at).toLocaleTimeString() : "Live"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 md:grid-cols-7">
                  {stageOrder.map((stage, index) => {
                    const active = index <= currentStageIndex;
                    const current = index === currentStageIndex;
                    return (
                      <div
                        key={stage}
                        className={`rounded-2xl border px-3 py-3 text-center text-[10px] uppercase tracking-[0.22em] transition ${
                          active ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-950/40 text-slate-500"
                        } ${current ? "shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_22px_rgba(34,211,238,0.15)]" : ""}`}
                      >
                        {stage}
                      </div>
                    );
                  })}
                </div>

                {lastSignal ? (
                  <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    Last signal: {lastSignal.vehicle_plate || lastSignal.type || "event"} · {lastSignal.supplier || "live"} · {activeState}
                  </div>
                ) : null}
              </div>
            </Card>
          </motion.div>

          <motion.div variants={panelReveal} initial="hidden" animate="visible" className="space-y-6">
            <Card title="Escalation Queue" subtitle="Anomalies and operator actions appear here first.">
              <div className="space-y-3">
                {escalationEvents.length ? (
                  escalationEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge label={(event.type || "EVENT").toUpperCase()} />
                            {event.state ? <Badge label={String(event.state).toUpperCase()} /> : null}
                          </div>
                          <p className="mt-3 text-sm text-slate-200">
                            {event.vehicle_plate || "Unknown vehicle"} · {event.supplier || "Unknown supplier"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {event.created_at ? new Date(event.created_at).toLocaleString() : "Live signal"}
                          </p>
                        </div>
                        <ShieldAlert className="mt-1 h-5 w-5 text-amber-300" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                    No escalations yet. The lane remains stable.
                  </div>
                )}
              </div>
            </Card>

            <Card title="Operator Posture" subtitle="The command surface remains evidence-led and audit ready.">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span>Current state</span>
                    <Badge label={activeState} />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span>Active signals</span>
                    <span className="text-white">{recentEvents.length}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span>Operator actions</span>
                    <span className="text-white">{operatorCount}</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.section variants={panelReveal} initial="hidden" animate="visible">
          <Card title="Forensic Chronology" subtitle="The bottom rail preserves the live incident narrative in order.">
            {recentEvents.length ? (
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                {recentEvents.slice(0, 8).map((event, index) => (
                  <div
                    key={event.id}
                    className="rounded-[22px] border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/25 hover:bg-cyan-500/10"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Badge label={(event.type || "event").toUpperCase()} />
                      <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
                        {index + 1}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-white">{event.vehicle_plate || "Unknown vehicle"}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{event.supplier || "Live event"}</p>
                    <p className="mt-3 text-sm text-slate-300">
                      {event.state ? String(event.state).toUpperCase() : "EVENT"}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span>{event.created_at ? new Date(event.created_at).toLocaleTimeString() : "Now"}</span>
                      <ChevronRight className="h-4 w-4 text-cyan-300" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                Waiting for live delivery signals.
              </div>
            )}
          </Card>
        </motion.section>
      </div>
    </OperationsLayout>
  );
};

export default OpsOverviewPage;
