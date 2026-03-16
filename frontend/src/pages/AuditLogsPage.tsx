import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchAuditLogs } from "../api/audit";
import { AuditLog } from "../types/audit";

const AuditLogsPage = () => {
  const { entityType, entityId } = useParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityType || !entityId) return;
    const load = async () => {
      try {
        const data = await fetchAuditLogs(entityType, entityId);
        setLogs(data);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load audit logs.");
      }
    };
    void load();
  }, [entityType, entityId]);

  if (!entityType || !entityId) {
    return <p className="text-sm text-slate">Select an audit record.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Audit Logs</p>
        <h2 className="text-2xl font-semibold text-ink">Audit Timeline</h2>
        <p className="mt-2 text-sm text-slate">
          {entityType} / {entityId}
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="border-l-2 border-accent pl-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate">
                {new Date(log.timestamp).toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-ink">{log.action}</p>
              <p className="text-xs text-slate">Performed by {log.performed_by_id}</p>
            </div>
          ))}
          {logs.length === 0 ? (
            <p className="text-sm text-slate">No audit activity available.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
