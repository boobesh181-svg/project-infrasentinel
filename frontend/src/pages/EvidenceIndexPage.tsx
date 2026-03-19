import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjectEntries, fetchProjects } from "../api/projects";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { MaterialEntry } from "../types/materialEntry";
import { Project } from "../types/project";

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
        const response = await fetchProjects();
        setProjects(response);
        if (response.length > 0) {
          setSelectedProjectId(response[0].id);
        }
      } catch (err: any) {
        setError(err?.message ?? "Unable to load projects.");
      }
    };
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const loadEntries = async () => {
      try {
        const response = await fetchProjectEntries(selectedProjectId);
        setEntries(response);
        setSelectedEntryId(response[0]?.id ?? "");
      } catch (err: any) {
        setError(err?.message ?? "Unable to load entries.");
      }
    };

    void loadEntries();
  }, [selectedProjectId]);

  return (
    <div className="space-y-4">
      <Card title="Evidence Workspace" subtitle="Choose a project and material entry to upload and verify evidence.">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="evidence-project" className="label-text text-slate-600">
              Project
            </label>
            <select
              id="evidence-project"
              aria-label="Project"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="evidence-entry" className="label-text text-slate-600">
              Material Entry
            </label>
            <select
              id="evidence-entry"
              aria-label="Material Entry"
              value={selectedEntryId}
              onChange={(event) => setSelectedEntryId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.material_name} ({entry.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button disabled={!selectedEntryId} onClick={() => navigate(`/app/material-entries/${selectedEntryId}/evidence`)}>
            Open Evidence
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default EvidenceIndexPage;
