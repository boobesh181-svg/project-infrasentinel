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
import Badge from "../components/ui/Badge";

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
      <section className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Audit Replay</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Forensic reconstruction timeline</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Replay submit, verify, approve, and lock transitions without leaving the incident context.
            </p>
          </div>

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <div>
              <label htmlFor="audit-entity-type" className="label-text text-slate-400">
                Entity type
              </label>
              <select
                id="audit-entity-type"
                aria-label="Entity type"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-sm text-white"
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
              <label htmlFor="audit-entity-id" className="label-text text-slate-400">
                Entity ID
              </label>
              <input
                id="audit-entity-id"
                aria-label="Entity ID"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-3 text-sm text-white placeholder:text-slate-500"
                placeholder="Enter UUID"
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
              />
            </div>
            <div className="self-end">
              <Button type="submit" disabled={isLoading || !entityId.trim()}>
                {isLoading ? "Loading..." : "Load timeline"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">
          <TriangleAlert className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/10 bg-white/5" title={title} subtitle="Chronological event trail.">
          <div className="space-y-4">
            {logs.map((log, index) => (
              <div key={log.id} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex w-10 flex-col items-center pt-1">
                  <div className="rounded-full border border-white/10 bg-white/5 p-2">{iconForAction(log.action)}</div>
                  {index !== logs.length - 1 ? <div className="mt-2 h-full w-px bg-white/10" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{log.action}</p>
                    <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge label={log.action.toUpperCase()} />
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">User {log.performed_by_id}</span>
                  </div>
                </div>
              </div>
            ))}
            {!isLoading && logs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                No events yet. Enter an entity ID and load timeline.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="border-white/10 bg-white/5" title="Replay Modes" subtitle="The replay stays deliberately narrow.">
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">Trace each operator transition in order.</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">Keep evidence visible while reviewing the chain of custody.</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">Use the timeline to reconstruct escalation and approval timing.</div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AuditPage;
