import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Radar, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { getDelivery } from "../api/ops";
import { useOpsSocket } from "../hooks/useOpsSocket";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

const LiveVerificationPage = () => {
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useOpsSocket((payload) => {
    setEvents((prev) => [payload, ...prev].slice(0, 12));
    if (payload.delivery_id && payload.delivery_id !== activeDeliveryId) {
      setActiveDeliveryId(payload.delivery_id);
    }
  });

  useEffect(() => {
    if (!activeDeliveryId) return;
    const load = async () => {
      try {
        const response = await getDelivery(activeDeliveryId);
        setDelivery(response);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load delivery.");
      }
    };
    void load();
  }, [activeDeliveryId]);

  const primaryEvidence = delivery?.evidence?.[0];
  const previewUrl = primaryEvidence?.storage_path || "";
  const invoiceLinks = delivery?.invoice_links || [];
  const topMatch = invoiceLinks.length ? invoiceLinks[0] : null;

  const suspiciousFlags = delivery?.suspicious_flags || [];
  const detectionConfidence = delivery?.detection_confidence ?? delivery?.confidence;
  const anprConfidence = delivery?.anpr_confidence ?? 0;

  const timeline = useMemo(() => {
    return events.map((event, index) => ({
      id: event.id || `${event.type || "event"}-${index}`,
      title: event.type || "event",
      state: event.state || event.phase || "LIVE",
      created_at: event.created_at || new Date().toISOString(),
      notes: event.reasoning || event.notes || "Live signal received"
    }));
  }, [events]);

  return (
    <div className="space-y-6">
      <section className="operational-panel rounded-[32px] px-6 py-6 md:px-7 md:py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Live Verification Lane</p>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
              Infrastructure delivery intelligence
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              Live camera ingest, AI verification, ANPR extraction, and invoice matching converge into a single operational surface.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em]">
            <Badge label="CAMERA LIVE" />
            <Badge label="AI DETECT" />
            <Badge label="ANPR READY" />
          </div>
        </div>
        {activeDeliveryId ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to={`/app/command-center/weighbridge/${activeDeliveryId}`}>
              <Button variant="secondary">Open weighbridge verification</Button>
            </Link>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Delivery {activeDeliveryId.slice(0, 8)}</span>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-2 text-cyan-200">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live camera feed</p>
                    <p className="text-sm text-slate-300">Site {delivery?.site_id ? String(delivery.site_id).slice(0, 8) : "—"}</p>
                  </div>
                </div>
                <Badge label={delivery?.state || "STANDBY"} />
              </div>
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80">
                {previewUrl ? (
                  <img src={previewUrl} alt="Live feed" className="h-[320px] w-full object-cover" />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">
                    Waiting for camera ingestion.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-slate-900/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Detected truck preview</p>
                <Radar className="h-4 w-4 text-cyan-300" />
              </div>
              <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-slate-900/70">
                {previewUrl ? (
                  <img src={previewUrl} alt="Detected truck" className="h-[220px] w-full object-cover" />
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Awaiting detection frame.</div>
                )}
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Detection confidence</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {detectionConfidence != null ? Number(detectionConfidence).toFixed(2) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Material type</p>
                  <p className="mt-2 text-white">{delivery?.detected_material_type || "Unassigned"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ANPR extraction</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Plate</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {delivery?.detected_plate || delivery?.vehicle_plate || "Unknown"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">ANPR confidence</p>
                  <p className="mt-2 text-white">{anprConfidence ? anprConfidence.toFixed(2) : "—"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Timestamp</p>
                  <p className="mt-2 text-white">
                    {delivery?.detected_at ? new Date(delivery.detected_at).toLocaleString() : "Pending"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Invoice match status</p>
              <div className="mt-4 space-y-3">
                {invoiceLinks.length ? (
                  invoiceLinks.slice(0, 3).map((link: any) => (
                    <div key={link.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Invoice {link.invoice_id.slice(0, 8)}</p>
                        <Badge label={`${(link.match_confidence || 0).toFixed(2)} CONF`} />
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{link.match_reason || "heuristic"}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                    No invoice linked yet. Matching in progress.
                  </div>
                )}
                {topMatch ? (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    Strongest match: {topMatch.match_reason || "heuristic"}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verification state</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <span className="text-sm text-slate-300">State</span>
                <Badge label={delivery?.state || "PENDING"} />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <span className="text-sm text-slate-300">Confidence</span>
                <span className="text-sm text-white">
                  {detectionConfidence != null ? Number(detectionConfidence).toFixed(2) : "—"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary">Request review</Button>
              <Button size="sm">Confirm verified</Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active anomaly alerts</p>
            <div className="mt-4 space-y-3">
              {suspiciousFlags.length ? (
                suspiciousFlags.map((flag: string) => (
                  <div key={flag} className="flex items-center justify-between rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
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
                  No anomalies detected.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Operational timeline</p>
            <div className="mt-4 space-y-3">
              {timeline.length ? (
                timeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <Badge label={String(item.state).toUpperCase()} />
                      <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-2 text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.notes}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  Waiting for live events.
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">
              {error}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default LiveVerificationPage;
