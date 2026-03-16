import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProject, fetchProjectEntries } from "../api/projects";
import { Project } from "../types/project";
import { MaterialEntry } from "../types/materialEntry";

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<MaterialEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      try {
        const [projectData, entryData] = await Promise.all([
          fetchProject(projectId),
          fetchProjectEntries(projectId)
        ]);
        setProject(projectData);
        setEntries(entryData);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError("Project not found. Refresh the list and try again.");
        } else {
          setError(err?.message ?? "Unable to load project.");
        }
      }
    };
    void load();
  }, [projectId]);

  if (!projectId) {
    return <p className="text-sm text-slate">Project not selected.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate">Project Detail</p>
          <h2 className="text-2xl font-semibold text-ink">{project?.name ?? "Loading"}</h2>
          <p className="mt-2 text-sm text-slate">{project?.location}</p>
        </div>
        <button
          onClick={() => navigate(`/app/projects/${projectId}/material-entries/new`)}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Create Material Entry
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
        <p className="text-sm font-semibold text-ink">Project Information</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate">Reporting Window</p>
            <p className="text-sm text-ink">
              {project
                ? `${project.reporting_period_start} - ${project.reporting_period_end}`
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate">Created</p>
            <p className="text-sm text-ink">
              {project ? new Date(project.created_at).toLocaleString() : "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Material Entries</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate">{entries.length} total</p>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.2em] text-slate">
            <tr>
              <th className="pb-3">Entry ID</th>
              <th className="pb-3">Material</th>
              <th className="pb-3">Quantity</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cloud">
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="cursor-pointer hover:bg-mist/70"
                onClick={() => navigate(`/app/material-entries/${entry.id}`)}
              >
                <td className="py-3 text-ink">{entry.id.slice(0, 8)}</td>
                <td className="py-3 text-ink">{entry.material_name}</td>
                <td className="py-3 text-slate">{entry.quantity}</td>
                <td className="py-3 text-slate">{entry.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-slate">No material entries logged yet.</p>
        ) : null}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
