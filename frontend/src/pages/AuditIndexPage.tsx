import { useState } from "react";
import { useNavigate } from "react-router-dom";

const AuditIndexPage = () => {
  const navigate = useNavigate();
  const [entityType, setEntityType] = useState("project");
  const [entityId, setEntityId] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!entityId) return;
    navigate(`/app/audit/${entityType}/${entityId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Audit Logs</p>
        <h2 className="text-2xl font-semibold text-ink">Audit Lookup</h2>
        <p className="mt-2 text-sm text-slate">
          Provide the entity type and ID to review its audit timeline.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-xl rounded-xl border border-cloud bg-white/90 p-6 shadow-soft"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="audit-entity-type"
              className="text-xs uppercase tracking-[0.2em] text-slate"
            >
              Entity Type
            </label>
            <select
              id="audit-entity-type"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="mt-2 w-full rounded-lg border border-cloud bg-white px-4 py-2 text-sm"
            >
              <option value="project">Project</option>
              <option value="material_entry">Material Entry</option>
              <option value="evidence">Evidence</option>
              <option value="notification">Notification</option>
              <option value="emission_factor">Emission Factor</option>
              <option value="audit">Audit Log</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="audit-entity-id"
              className="text-xs uppercase tracking-[0.2em] text-slate"
            >
              Entity ID
            </label>
            <input
              id="audit-entity-id"
              type="text"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-cloud bg-white px-4 py-2 text-sm"
              placeholder="UUID"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          View Audit Logs
        </button>
      </form>
    </div>
  );
};

export default AuditIndexPage;
