import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/ui/Card";
import { getDelivery, verifyDelivery } from "../api/ops";
import OperationsLayout from "../components/layout/OperationsLayout";
import EvidenceModal from "../components/ops/EvidenceModal";
import Timeline from "../components/ops/Timeline";
import Badge from "../components/ui/Badge";
import { CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import Button from "../components/ui/Button";
import { motion } from "framer-motion";
import { panelReveal, staggerContainer, staggerItem } from "../animations/variants";

const VerificationPage = () => {
  const { deliveryId } = useParams();
  const [delivery, setDelivery] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEvidence, setModalEvidence] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await getDelivery(deliveryId!);
        setDelivery(resp);
      } catch (err) {
        console.error(err);
      }
    };
    void load();
  }, [deliveryId]);

  const doAction = async (action: string) => {
    setIsSubmitting(true);
    try {
      await verifyDelivery(deliveryId!, { action });
      const resp = await getDelivery(deliveryId!);
      setDelivery(resp);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!delivery) return <div>Loading...</div>;

  const currentState = String(delivery.state || "DETECTED").toUpperCase();

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <motion.section variants={panelReveal} initial="hidden" animate="visible" className="operational-panel rounded-[30px] px-6 py-6 md:px-7 md:py-7">
          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Command Center / Incident Brief</p>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">Delivery Verification</h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-300">
                Evidence, AI verdicts, and operator action remain in one lane so the incident can be reconstructed with precision.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={currentState} />
                <Badge label={`EVIDENCE ${delivery.evidence?.length || 0}`} />
                <Badge label={`CHECKPOINTS ${delivery.verification_results?.length || 0}`} />
              </div>
            </div>

            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Confidence", value: delivery.confidence != null ? Number(delivery.confidence).toFixed(2) : "—" },
                { label: "Evidence", value: delivery.evidence?.length || 0 },
                { label: "Actions", value: delivery.verification_results?.length || 0 }
              ].map((item) => (
                <motion.div key={item.label} variants={staggerItem} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-ring" />
              live evidence replay
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              operator trace preserved
            </span>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <motion.div variants={panelReveal} initial="hidden" animate="visible">
            <Timeline
              delivery={delivery}
              isSubmitting={isSubmitting}
              onOpenEvidence={(evidence) => {
                setModalEvidence(evidence);
                setModalOpen(true);
              }}
              onAction={doAction}
            />
          </motion.div>

          <motion.aside variants={panelReveal} initial="hidden" animate="visible" className="space-y-6">
            <Card title="Trust Brief" subtitle="High-trust metadata stays visible at all times.">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Supplier</p>
                  <p className="mt-2 text-white">{delivery.supplier || "Unknown"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Vehicle</p>
                  <p className="mt-2 text-white">{delivery.vehicle_plate || "Unknown"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Site</p>
                  <p className="mt-2 text-white">{delivery.site_id ? String(delivery.site_id).slice(0, 8) : "—"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Timestamp</p>
                  <p className="mt-2 text-white">{delivery.occurred_at ? new Date(delivery.occurred_at).toLocaleString() : "—"}</p>
                </div>
              </div>
            </Card>

            <Card title="Operator Actions" subtitle="Use deliberate actions to lock the replay state.">
              <div className="grid gap-3">
                <Button disabled={isSubmitting} onClick={() => void doAction("CONFIRM")}>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm
                </Button>
                <Button variant="secondary" disabled={isSubmitting} onClick={() => void doAction("REVIEW")}>
                  <ShieldAlert className="h-4 w-4" />
                  Request review
                </Button>
                <Button variant="danger" disabled={isSubmitting} onClick={() => void doAction("ESCALATE")}>
                  <ShieldAlert className="h-4 w-4" />
                  Escalate
                </Button>
              </div>
            </Card>
          </motion.aside>
        </div>
      </div>
      <EvidenceModal open={modalOpen} evidence={modalEvidence} onClose={() => setModalOpen(false)} />
    </OperationsLayout>
  );
};

export default VerificationPage;
