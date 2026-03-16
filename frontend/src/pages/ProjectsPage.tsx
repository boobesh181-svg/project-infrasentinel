import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjects } from "../api/projects";
import { Project } from "../types/project";

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchProjects();
        setProjects(data);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load projects.");
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Projects</p>
        <h2 className="text-2xl font-semibold text-ink">Active Compliance Programs</h2>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.2em] text-slate">
            <tr>
              <th className="pb-3">Project</th>
              <th className="pb-3">Created</th>
              <th className="pb-3">Entries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cloud">
            {projects.map((project) => (
              <tr
                key={project.id}
                className="cursor-pointer text-ink hover:bg-mist/70"
                onClick={() => navigate(`/app/projects/${project.id}`)}
              >
                <td className="py-3 font-medium">{project.name}</td>
                <td className="py-3 text-slate">
                  {new Date(project.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 text-slate">View</td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-slate">No projects found.</p>
        ) : null}
      </div>
    </div>
  );
};

export default ProjectsPage;
