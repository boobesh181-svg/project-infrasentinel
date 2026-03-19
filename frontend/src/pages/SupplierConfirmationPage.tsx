import { useState } from "react";
import { supplierConfirmDelivery } from "../api/antiCorruption";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const SupplierConfirmationPage = () => {
  const [entryId, setEntryId] = useState("");
  const [confirmationStatus, setConfirmationStatus] = useState<"ACK" | "DISPUTE">("ACK");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);
    try {
      await supplierConfirmDelivery({
        entry_id: entryId.trim(),
        confirmation_status: confirmationStatus,
        comment: comment || undefined
      });
      setMessage("Delivery confirmation submitted successfully.");
      setComment("");
    } catch (err: any) {
      setError(err?.message ?? "Unable to submit confirmation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Supplier Delivery Confirmation" subtitle="Confirm or dispute submitted material delivery.">
        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="label-text text-slate-600" htmlFor="entry-id">Entry ID</label>
            <input
              id="entry-id"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={entryId}
              onChange={(event) => setEntryId(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label-text text-slate-600" htmlFor="confirmation-status">Status</label>
            <select
              id="confirmation-status"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={confirmationStatus}
              onChange={(event) => setConfirmationStatus(event.target.value as "ACK" | "DISPUTE")}
            >
              <option value="ACK">ACK</option>
              <option value="DISPUTE">DISPUTE</option>
            </select>
          </div>
          <div>
            <label className="label-text text-slate-600" htmlFor="supplier-comment">Comment</label>
            <textarea
              id="supplier-comment"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={isLoading}>{isLoading ? "Submitting..." : "Submit Confirmation"}</Button>
        </form>
      </Card>

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default SupplierConfirmationPage;
