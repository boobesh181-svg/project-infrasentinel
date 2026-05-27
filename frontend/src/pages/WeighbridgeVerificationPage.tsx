import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Scale,
  ShieldAlert,
  Sigma,
  Timer,
  Truck
} from "lucide-react";
import { getDelivery } from "../api/ops";
import { captureGross, captureTare, getWeighbridgeByDelivery } from "../api/weighbridge";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import OperationsLayout from "../components/layout/OperationsLayout";

const WeighbridgeVerificationPage = () => {
  const { deliveryId } = useParams();
  const [delivery, setDelivery] = useState<any | null>(null);
  const [event, setEvent] = useState<any | null>(null);
  const [grossInput, setGrossInput] = useState(0);
  const [tareInput, setTareInput] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deliveryId) return;
    const load = async () => {
      try {
        const [deliveryResp, weighbridgeResp] = await Promise.all([
          getDelivery(deliveryId),
          getWeighbridgeByDelivery(deliveryId)
        ]);
        setDelivery(deliveryResp);
        setEvent(weighbridgeResp);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load weighbridge data.");
      }
    };
    void load();
  }, [deliveryId]);

  const expectedQuantity = event?.expected_quantity ?? delivery?.expected_quantity ?? null;
  const netWeight = event?.net_weight ?? (event?.gross_weight && event?.tare_weight ? event.gross_weight - event.tare_weight : null);
  const mismatchPercent = event?.mismatch_percent != null ? event.mismatch_percent : null;

  const onCaptureGross = async () => {
      <div className="space-y-6">
        <section className="operational-panel rounded-[32px] px-6 py-6 md:px-7 md:py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Weighbridge Verification Lane</p>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
                Physical quantity verification
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                Gross and tare weights are captured at the weighbridge, net quantity is calculated, and supplier invoices are verified.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em]">
              <Badge label="WEIGHBRIDGE LIVE" />
              <Badge label="QUANTITY CHECK" />
              <Badge label={event?.status || "STANDBY"} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {[
                { label: "Gross Weight", value: event?.gross_weight ?? "—", icon: Scale },
                { label: "Tare Weight", value: event?.tare_weight ?? "—", icon: Truck },
                { label: "Net Weight", value: netWeight ?? "—", icon: Sigma }
              ].map((item) => (
                <div key={item.label} className="rounded-[26px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-cyan-200" />
                    <p className="text-2xl font-semibold text-white">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Weighbridge capture</p>
                  <p className="mt-2 text-sm text-slate-300">Capture gross and tare weights in sequence.</p>
                </div>
                <Badge label={event?.status || "AWAITING GROSS"} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Gross weight (kg)</p>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={grossInput}
                    onChange={(event) => setGrossInput(Number(event.target.value))}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    aria-label="Gross weight"
                  />
                  <Button className="mt-3" disabled={loading} onClick={onCaptureGross}>
                    Capture gross
                  </Button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Tare weight (kg)</p>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={tareInput}
                    onChange={(event) => setTareInput(Number(event.target.value))}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    aria-label="Tare weight"
                  />
                  <Button className="mt-3" variant="secondary" disabled={loading || !event} onClick={onCaptureTare}>
                    Capture tare
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Invoice comparison</p>
                  <p className="mt-2 text-sm text-slate-300">Net weighbridge total vs supplier invoice quantity.</p>
                </div>
                <Badge label={event?.status || "PENDING"} />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Invoice qty</p>
                  <p className="mt-2 text-xl font-semibold text-white">{expectedQuantity ?? "—"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Net weight</p>
                  <p className="mt-2 text-xl font-semibold text-white">{netWeight ?? "—"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Mismatch</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {mismatchPercent != null ? `${(mismatchPercent * 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-cyan-200" />
                  {event?.tare_captured_at
                    ? `Verified at ${new Date(event.tare_captured_at).toLocaleString()}`
                    : "Awaiting tare capture to finalize verification."}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verification status</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <span className="text-sm text-slate-300">State</span>
                  <Badge label={event?.status || "STANDBY"} />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <span className="text-sm text-slate-300">Delivery</span>
                  <span className="text-sm text-white">{delivery?.vehicle_plate || "Unknown"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mismatch alerts</p>
              <div className="mt-4 space-y-3">
                {anomalyFlags.length ? (
                  anomalyFlags.map((flag: string) => (
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
                    No weighbridge anomalies detected.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/60 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Evidence history</p>
              <div className="mt-4 space-y-3">
                {evidence.length ? (
                  evidence.slice(0, 4).map((item: any) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <Badge label={item.content_type || "evidence"} />
                        <span className="text-xs text-slate-500">{new Date(item.uploaded_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-2 text-white">{item.file_name}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                    No weighbridge evidence uploaded yet.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
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
                  No weighbridge anomalies detected.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Evidence history</p>
            <div className="mt-4 space-y-3">
              {evidence.length ? (
                evidence.slice(0, 4).map((item: any) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <Badge label={item.content_type || "evidence"} />
                      <span className="text-xs text-slate-500">{new Date(item.uploaded_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-2 text-white">{item.file_name}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  No weighbridge evidence uploaded yet.
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
    </OperationsLayout>
  );
};

export default WeighbridgeVerificationPage;
