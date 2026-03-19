import { useEffect, useState } from "react";
import { fetchBimDiscrepancies } from "../api/analytics";
import { fetchProjects, uploadProjectBim } from "../api/projects";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { BIMDiscrepancy } from "../types/bim";
import { Project } from "../types/project";

const BimValidationPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [discrepancies, setDiscrepancies] = useState<BIMDiscrepancy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const load = async () => {
    try {
      const [projectList, discrepancyList] = await Promise.all([
        fetchProjects(),
        fetchBimDiscrepancies()
      ]);
      setProjects(projectList);
      setDiscrepancies(discrepancyList);
      if (projectList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? "Unable to load BIM data.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId || !selectedFile) return;

    setIsUploading(true);
    setError(null);
    try {
      await uploadProjectBim(selectedProjectId, selectedFile);
      setSelectedFile(null);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Unable to upload BIM model.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="BIM Upload" subtitle="Upload IFC/RVT/GLTF model for material extraction and validation.">
        <form className="space-y-3" onSubmit={onUpload}>
          <div>
            <label className="label-text text-slate-600" htmlFor="bim-project">Project</label>
            <select
              id="bim-project"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              {projects.map((project) => (
                <option value={project.id} key={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text text-slate-600" htmlFor="bim-file">Model File</label>
            <input
              id="bim-file"
              type="file"
              accept=".ifc,.rvt,.gltf"
              className="mt-1 block w-full text-sm"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <Button type="submit" disabled={isUploading || !selectedFile}>
            {isUploading ? "Uploading..." : "Upload BIM Model"}
          </Button>
        </form>
      </Card>

      <Card title="BIM Discrepancy Visualization" subtitle="Reported material quantity vs BIM-derived estimates.">
        <Table headers={["Project", "Material", "Estimated", "Reported", "Discrepancy"]}>
          {discrepancies.map((item, index) => (
            <TableRow key={`${item.project_id}-${item.material_type}-${index}`}>
              <TableCell>{item.project_name}</TableCell>
              <TableCell>{item.material_type}</TableCell>
              <TableCell>{item.estimated_quantity.toFixed(2)}</TableCell>
              <TableCell>{item.reported_quantity.toFixed(2)}</TableCell>
              <TableCell>{(item.discrepancy_ratio * 100).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
          {discrepancies.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No BIM discrepancies flagged yet.
              </td>
            </TableRow>
          ) : null}
        </Table>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default BimValidationPage;
