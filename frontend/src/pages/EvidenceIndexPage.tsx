import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjects, fetchProjectEntries } from "../api/projects";
import { Project } from "../types/project";
import { MaterialEntry } from "../types/materialEntry";

const EvidenceIndexPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<MaterialEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await fetchProjects();
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      } catch (err: any) {
        setError(err?.message ?? "Unable to load projects.");
      }
    };
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setEntries([]);
      setSelectedEntryId("");
      return;
    }
    const loadEntries = async () => {
      try {
        const data = await fetchProjectEntries(selectedProjectId);
        setEntries(data);
        if (data.length > 0) {
          setSelectedEntryId(data[0].id);
        } else {
          setSelectedEntryId("");
        }
      } catch (err: any) {
        setError(err?.message ?? "Unable to load material entries.");
      }
    };
    void loadEntries();
  }, [selectedProjectId]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) {
      setError("Select a project first.");
      return;
    }
    if (!selectedEntryId) {
      setError("Select a material entry first.");
      return;
    }
    navigate(`/app/material-entries/${selectedEntryId}/evidence`);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Evidence</p>
        <h2 className="text-2xl font-semibold text-ink">Evidence Access</h2>
        <p className="mt-2 text-sm text-slate">
          Select a project and material entry to view and upload evidence files.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form
        onSubmit={handleSubmit}
        className="max-w-xl rounded-xl border border-cloud bg-white/90 p-6 shadow-soft"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="evidence-project"
              className="text-xs uppercase tracking-[0.2em] text-slate"
            >
              Project
            </label>
            <select
              id="evidence-project"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-cloud bg-white px-4 py-2 text-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="evidence-entry"
              className="text-xs uppercase tracking-[0.2em] text-slate"
            >
              Material Entry
            </label>
            <select
              id="evidence-entry"
              value={selectedEntryId}
              onChange={(event) => setSelectedEntryId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-cloud bg-white px-4 py-2 text-sm"
              disabled={entries.length === 0}
            >
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.material_name} - {entry.id.slice(0, 8)}
                </option>
              ))}
            </select>
            {entries.length === 0 ? (
              <p className="mt-2 text-xs text-slate">No entries found for this project.</p>
            ) : null}
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
          disabled={!selectedEntryId}
        >
          Open Evidence
        </button>
      </form>
    </div>
  );
};

export default EvidenceIndexPage;
