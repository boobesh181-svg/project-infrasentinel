import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchProjectEntries, fetchProjects } from "../api/projects";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { MaterialEntry } from "../types/materialEntry";
import { Project } from "../types/project";

type ProjectRow = {
  project: Project;
  entries: MaterialEntry[];
  status: string;
};

const PAGE_SIZE = 8;

const projectStatus = (entries: MaterialEntry[]): string => {
  if (entries.some((entry) => entry.status === "LOCKED")) return "LOCKED";
  if (entries.some((entry) => entry.status === "APPROVED")) return "APPROVED";
  if (entries.some((entry) => entry.status === "VERIFIED")) return "VERIFIED";
  if (entries.some((entry) => entry.status === "SUBMITTED")) return "SUBMITTED";
  return "DRAFT";
};

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const projects = await fetchProjects();
        const entriesByProject = await Promise.all(
          projects.map(async (project) => ({
            project,
            entries: await fetchProjectEntries(project.id)
          }))
        );

        setRows(
          entriesByProject.map(({ project, entries }) => ({
            project,
            entries,
            status: projectStatus(entries)
          }))
        );
      } catch (err: any) {
        setError(err?.message ?? "Unable to load projects.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter(({ project }) =>
      [project.name, project.location].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <Card title="Projects" subtitle="Manage reporting periods and workflow progress across projects.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="project-search" className="sr-only">
            Search projects
          </label>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              id="project-search"
              aria-label="Search projects"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-72 max-w-full text-sm"
              placeholder="Search by name or location"
            />
          </div>
          <Button onClick={() => navigate("/app/projects")}> 
            <Plus className="mr-2 inline h-4 w-4" />
            New Project
          </Button>
        </div>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <Table
        headers={[
          "Project Name",
          "Location",
          "Reporting Period",
          "Entries Count",
          "Status",
          "Actions"
        ]}
      >
        {isLoading ? (
          <TableRow>
            <td colSpan={6} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
              Loading projects...
            </td>
          </TableRow>
        ) : (
          paginatedRows.map(({ project, entries, status }) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium text-slate-900">{project.name}</TableCell>
              <TableCell>{project.location}</TableCell>
              <TableCell>
                {project.reporting_period_start} to {project.reporting_period_end}
              </TableCell>
              <TableCell>{entries.length}</TableCell>
              <TableCell>
                <Badge label={status} />
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/app/projects/${project.id}`)}>
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/app/projects/${project.id}/material-entries/new`)}
                  >
                    Add Entry
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </Table>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {paginatedRows.length} of {filteredRows.length} projects
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="px-2 py-1 text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
