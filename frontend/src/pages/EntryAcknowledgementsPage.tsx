import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  acknowledgeEntryEvidence,
  disputeEntryEvidence,
  fetchEntryAcknowledgements
} from "../api/antiCorruption";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { EvidenceAcknowledgement } from "../types/antiCorruption";

const EntryAcknowledgementsPage = () => {
  const { entryId } = useParams();
  const [items, setItems] = useState<EvidenceAcknowledgement[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    if (!entryId) return;
    try {
      const response = await fetchEntryAcknowledgements(entryId);
      setItems(response);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load acknowledgements.");
    }
  };

  useEffect(() => {
    void load();
  }, [entryId]);

  const onAction = async (action: "ack" | "dispute") => {
    if (!entryId) return;
    setError(null);
    setIsLoading(true);
    try {
      if (action === "ack") {
        await acknowledgeEntryEvidence(entryId, comment || undefined);
      } else {
        await disputeEntryEvidence(entryId, comment || undefined);
      }
      setComment("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit response.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Evidence Acknowledgement" subtitle={`Entry: ${entryId ?? "N/A"}`}>
        <div className="space-y-3">
          <textarea
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            placeholder="Optional comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="flex gap-2">
            <Button disabled={isLoading} onClick={() => onAction("ack")}>Acknowledge</Button>
            <Button variant="secondary" disabled={isLoading} onClick={() => onAction("dispute")}>
              Dispute
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Acknowledgement Timeline" subtitle="Verifier, auditor, and supplier responses.">
        <Table headers={["Role", "Response", "Comment", "Timestamp"]}>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.role}</TableCell>
              <TableCell>{item.response_type}</TableCell>
              <TableCell>{item.comment || "-"}</TableCell>
              <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <td colSpan={4} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No acknowledgements yet.
              </td>
            </TableRow>
          ) : null}
        </Table>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default EntryAcknowledgementsPage;
