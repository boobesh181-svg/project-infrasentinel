import OperationsLayout from "../components/layout/OperationsLayout";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ForensicTimeline from "../components/ops/ForensicTimeline";
import { getDelivery } from "../api/ops";
import { getWeighbridgeByDelivery } from "../api/weighbridge";

const AuditReplay = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("delivery_id") || searchParams.get("id");
  const [delivery, setDelivery] = useState<any | null>(null);
  const [weighbridge, setWeighbridge] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const d = await getDelivery(id);
        setDelivery(d);
        const w = await getWeighbridgeByDelivery(id);
        setWeighbridge(w);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load replay data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleOpenEvidence = (evidence: any) => {
    // open in Timeline lightbox via simple event - Timeline handles lightbox internally via prop
    // fallback: open evidence in new tab if storage path exists
    if (evidence?.storage_path) window.open(evidence.storage_path, "_blank");
  };

  const handleAction = async (action: string) => {
    // Placeholder to call verifyDelivery or other action endpoints in the future
    console.log("replay action", action);
  };

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <section className="operational-panel rounded-[28px] px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Investigation</p>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white">Incident / Audit Replay</h1>
              <p className="mt-1 text-sm text-slate-300">Replay the full evidence chain, invoice comparison and verification checkpoints for a selected delivery.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Delivery</p>
              <p className="mt-1 text-sm font-medium text-white">{id ?? "(select delivery_id in URL)"}</p>
            </div>
          </div>
        </section>

        <div>
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 text-sm text-slate-400">Loading replay...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-950/30 p-6 text-sm text-rose-200">{error}</div>
          ) : (
            <ForensicTimeline delivery={delivery} />
          )}
        </div>
      </div>
    </OperationsLayout>
  );
};

export default AuditReplay;
