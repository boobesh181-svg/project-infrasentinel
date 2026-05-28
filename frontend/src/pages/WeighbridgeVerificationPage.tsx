import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Scale, Truck, Sigma } from "lucide-react";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import OperationsLayout from "../components/layout/OperationsLayout";
import { getDelivery } from "../api/ops";
import { getWeighbridgeByDelivery } from "../api/weighbridge";

const WeighbridgeVerificationPage = () => {
  const { deliveryId } = useParams();
  const [delivery, setDelivery] = useState<any | null>(null);
  const [weigh, setWeigh] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deliveryId) return;
    setLoading(true);
    Promise.all([getDelivery(deliveryId), getWeighbridgeByDelivery(deliveryId)])
      .then(([d, w]) => {
        setDelivery(d);
        setWeigh(w);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deliveryId]);

  const netWeight = useMemo(() => {
    if (!weigh) return null;
    if (weigh.net_weight != null) return weigh.net_weight;
    if (weigh.gross_weight != null && weigh.tare_weight != null) return weigh.gross_weight - weigh.tare_weight;
    return null;
  }, [weigh]);

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <section className="operational-panel px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Weighbridge</p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white">Weighbridge Verification</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-300">Delivery</p>
              <p className="mt-1 text-2xl font-semibold text-white">{delivery?.vehicle_plate || "—"}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="border border-white/10 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Gross Weight</p>
            <div className="mt-3 flex items-center gap-3">
              <Scale className="h-5 w-5 text-cyan-200" />
              <p className="text-2xl font-semibold text-white">{weigh?.gross_weight ?? "—"}</p>
            </div>
          </div>
          <div className="border border-white/10 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Tare Weight</p>
            <div className="mt-3 flex items-center gap-3">
              <Truck className="h-5 w-5 text-cyan-200" />
              <p className="text-2xl font-semibold text-white">{weigh?.tare_weight ?? "—"}</p>
            </div>
          </div>
          <div className="border border-white/10 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Net Weight</p>
            <div className="mt-3 flex items-center gap-3">
              <Sigma className="h-5 w-5 text-cyan-200" />
              <p className="text-2xl font-semibold text-white">{netWeight ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="border border-white/10 bg-slate-950/60 p-4">
          <p className="text-sm text-slate-300">Invoice vs Weighbridge</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Invoice Qty</p>
              <p className="text-lg text-white">{delivery?.expected_quantity ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Mismatch</p>
              <p className="text-lg text-white">{delivery?.expected_quantity != null && netWeight != null ? `${Math.abs(delivery.expected_quantity - netWeight)}` : "—"}</p>
            </div>
            <div>
              <Button disabled={loading}>Mark Resolved</Button>
            </div>
          </div>
        </div>
      </div>
    </OperationsLayout>
  );
};

export default WeighbridgeVerificationPage;
