import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/ui/Card";
import { getDelivery, verifyDelivery } from "../api/ops";
import OperationsLayout from "../components/layout/OperationsLayout";
import EvidenceModal from "../components/ops/EvidenceModal";

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

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Delivery Verification</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Vehicle" subtitle={delivery.vehicle_plate || "Unknown"}>
            <p>Supplier: {delivery.supplier}</p>
            <p>Expected: {delivery.expected_quantity ?? "—"}</p>
            <p>Detected: {delivery.detected_quantity ?? "—"}</p>
            <p>Confidence: {delivery.confidence ?? "—"}</p>
          </Card>
          <Card title="Evidence">
            {delivery.evidence?.length ? (
              delivery.evidence.map((e: any) => (
                <div key={e.id} className="mb-2">
                  <button
                    className="text-indigo-600 underline"
                    onClick={() => {
                      setModalEvidence(e);
                      setModalOpen(true);
                    }}
                  >
                    {e.file_name}
                  </button>
                </div>
              ))
            ) : (
              <div>No evidence</div>
            )}
          </Card>
          <Card title="Actions">
            <div className="space-y-2">
              <button className="w-full rounded bg-emerald-600 px-4 py-2 text-white" onClick={() => doAction("CONFIRM")} disabled={isSubmitting}>
                Confirm
              </button>
              <button className="w-full rounded bg-amber-500 px-4 py-2 text-white" onClick={() => doAction("REVIEW")} disabled={isSubmitting}>
                Request Review
              </button>
              <button className="w-full rounded bg-rose-600 px-4 py-2 text-white" onClick={() => doAction("ESCALATE")} disabled={isSubmitting}>
                Escalate
              </button>
            </div>
          </Card>
        </div>
      </div>
      <EvidenceModal open={modalOpen} evidence={modalEvidence} onClose={() => setModalOpen(false)} />
    </OperationsLayout>
  );
};

export default VerificationPage;
