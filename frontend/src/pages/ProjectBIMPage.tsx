import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchProject,
  fetchProjectBimDiscrepancies,
  fetchProjectBimEstimates,
  uploadProjectBim
} from "../api/projects";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { ProjectBIMDiscrepancy, ProjectBIMEstimate } from "../types/bim";

const statusPill = (status: "OK" | "WARNING" | "HIGH") => {
  const className =
    status === "OK"
      ? "bg-emerald-100 text-emerald-700"
      : status === "WARNING"
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${className}`}>{status}</span>;
};

const ProjectBIMPage = () => {
  const { projectId } = useParams();
  const [projectName, setProjectName] = useState("Project");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [estimates, setEstimates] = useState<ProjectBIMEstimate[]>([]);
  const [discrepancies, setDiscrepancies] = useState<ProjectBIMDiscrepancy[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    try {
      setError(null);
      const [project, estimateRows, discrepancyRows] = await Promise.all([
        fetchProject(projectId),
        fetchProjectBimEstimates(projectId),
        fetchProjectBimDiscrepancies(projectId)
      ]);
      setProjectName(project.name);
      setEstimates(estimateRows);
      setDiscrepancies(discrepancyRows);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load BIM validation data.");
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const onUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId || !selectedFile) return;

    setError(null);
    setIsUploading(true);
    try {
      await uploadProjectBim(projectId, selectedFile);
      setSelectedFile(null);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Unable to upload BIM model.");
    } finally {
      setIsUploading(false);
    }
  };

  const highDiscrepancies = useMemo(
    () => discrepancies.filter((item) => item.status === "HIGH"),
    [discrepancies]
  );

  return (
    <div className="space-y-4">
      <Card title={`Project BIM Validation - ${projectName}`} subtitle="Upload IFC and compare BIM-estimated quantities against reported entries.">
        <form className="space-y-3" onSubmit={onUpload}>
          <div>
            <label htmlFor="project-bim-file" className="label-text text-slate-600">IFC Model</label>
            <input
              id="project-bim-file"
              type="file"
              accept=".ifc"
              className="mt-1 block w-full text-sm"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <Button type="submit" disabled={isUploading || !selectedFile}>
            {isUploading ? "Uploading..." : "Upload BIM (IFC)"}
          </Button>
        </form>
      </Card>

      <Card title="BIM Estimates vs Reported Materials" subtitle="Discrepancy is absolute difference ratio in percent.">
        <Table headers={["Material", "Estimated", "Reported", "Discrepancy", "Status"]}>
          {estimates.map((item) => (
            <TableRow key={item.material}>
              <TableCell className="font-medium text-slate-900">{item.material}</TableCell>
              <TableCell>{item.estimated.toFixed(2)}</TableCell>
              <TableCell>{item.reported.toFixed(2)}</TableCell>
              <TableCell>{item.discrepancy.toFixed(2)}%</TableCell>
              <TableCell>{statusPill(item.status)}</TableCell>
            </TableRow>
          ))}
          {estimates.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No BIM estimates available yet. Upload an IFC model first.
              </td>
            </TableRow>
          ) : null}
        </Table>
      </Card>

      <Card title="Flagged Discrepancies" subtitle="Rows here exceed the 30% threshold.">
        <Table headers={["Material", "Estimated", "Reported", "Discrepancy", "Status"]}>
          {discrepancies.map((item) => (
            <TableRow key={`flagged-${item.material}`}>
              <TableCell className="font-medium text-slate-900">{item.material}</TableCell>
              <TableCell>{item.estimated.toFixed(2)}</TableCell>
              <TableCell>{item.reported.toFixed(2)}</TableCell>
              <TableCell>{item.discrepancy.toFixed(2)}%</TableCell>
              <TableCell>{statusPill(item.status)}</TableCell>
            </TableRow>
          ))}
          {discrepancies.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No discrepancies above 30%.
              </td>
            </TableRow>
          ) : null}
        </Table>
      </Card>

      {highDiscrepancies.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          High discrepancy detected (example: BIM 400 vs reported 120 -&gt; HIGH).
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default ProjectBIMPage;
