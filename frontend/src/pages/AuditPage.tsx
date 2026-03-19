import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Send,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";
import { fetchAuditLogs } from "../api/audit";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

type TimelineItem = {
  id: string;
  action: string;
  performed_by_id: string;
  timestamp: string;
};

const iconForAction = (action: string) => {
  const normalized = action.toLowerCase();
  if (normalized.includes("submit")) return <Send className="h-4 w-4 text-blue-600" />;
  if (normalized.includes("verify")) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (normalized.includes("approve")) return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (normalized.includes("lock")) return <Lock className="h-4 w-4 text-slate-700" />;
  return <ClipboardCheck className="h-4 w-4 text-slate-600" />;
};

const AuditPage = () => {
  const [entityType, setEntityType] = useState("material_entry");
  const [entityId, setEntityId] = useState("");
  const [logs, setLogs] = useState<TimelineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const title = useMemo(() => `${entityType} / ${entityId || "-"}`, [entityId, entityType]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entityId.trim()) return;
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetchAuditLogs(entityType, entityId.trim());
      setLogs(response);
    } catch (err: any) {
      setLogs([]);
      setError(err?.message ?? "Failed to load audit timeline.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Audit Timeline" subtitle="Track submit, verify, approve, and lock events in sequence.">
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <div>
            <label htmlFor="audit-entity-type" className="label-text text-slate-600">
              Entity type
            </label>
            <select
              id="audit-entity-type"
              aria-label="Entity type"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            >
              <option value="project">project</option>
              <option value="material_entry">material_entry</option>
              <option value="evidence">evidence</option>
              <option value="notification">notification</option>
              <option value="emission_factor">emission_factor</option>
              <option value="audit">audit</option>
            </select>
          </div>
          <div>
            <label htmlFor="audit-entity-id" className="label-text text-slate-600">
              Entity ID
            </label>
            <input
              id="audit-entity-id"
              aria-label="Entity ID"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Enter UUID"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
            />
          </div>
          <div className="self-end">
            <Button type="submit" disabled={isLoading || !entityId.trim()}>
              {isLoading ? "Loading..." : "Load"}
            </Button>
          </div>
        </form>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <TriangleAlert className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : null}

      <Card title={title} subtitle="Chronological event trail.">
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-3 border-l-2 border-slate-200 pl-3">
              <div className="pt-1">{iconForAction(log.action)}</div>
              <div>
                <p className="text-sm font-medium text-slate-900">{log.action}</p>
                <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</p>
                <p className="text-xs text-slate-500">User {log.performed_by_id}</p>
              </div>
            </div>
          ))}
          {!isLoading && logs.length === 0 ? (
            <p className="text-sm text-slate-500">No events yet. Enter an entity ID and load timeline.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
};

export default AuditPage;
