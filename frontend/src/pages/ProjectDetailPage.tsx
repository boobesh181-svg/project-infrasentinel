import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchProject, fetchProjectEntries } from "../api/projects";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { MaterialEntry } from "../types/materialEntry";
import { Project } from "../types/project";

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<MaterialEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [projectData, entryData] = await Promise.all([
          fetchProject(projectId),
          fetchProjectEntries(projectId)
        ]);
        setProject(projectData);
        setEntries(entryData);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load project.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [projectId]);

  if (!projectId) {
    return <p className="text-sm text-slate-500">No project selected.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title text-slate-900">{project?.name ?? "Project"}</h2>
            <p className="mt-1 text-sm text-slate-500">{project?.location ?? "Location"}</p>
            <p className="mt-1 text-xs text-slate-500">
              Reporting Period: {project?.reporting_period_start} to {project?.reporting_period_end}
            </p>
          </div>
          <Button onClick={() => navigate(`/app/projects/${projectId}/material-entries/new`)}>
            Add Material Entry
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/app/projects/${projectId}/bim`)}>
            BIM Validation
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <Card title="Material Entries" subtitle="Click an entry to manage workflow and evidence.">
        <Table headers={["Entry", "Material", "Quantity", "Calculated Emission", "Status", "Actions"]}>
          {isLoading ? (
            <TableRow>
              <td colSpan={6} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                Loading entries...
              </td>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.id.slice(0, 8)}</TableCell>
                <TableCell className="font-medium text-slate-900">{entry.material_name}</TableCell>
                <TableCell>{entry.quantity}</TableCell>
                <TableCell>{entry.calculated_emission.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge label={entry.status} />
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/app/material-entries/${entry.id}`)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </Table>
      </Card>
    </div>
  );
};

export default ProjectDetailPage;
