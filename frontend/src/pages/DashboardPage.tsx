import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCheck, ClipboardList, FolderKanban, GitCompareArrows, Truck } from "lucide-react";
import {
  fetchAntiCorruptionSummary,
  fetchEmissionsByMaterial,
  fetchEmissionsByProject,
  fetchEmissionsByTime
} from "../api/analytics";
import { fetchProjects } from "../api/projects";
import { fetchNotifications } from "../api/notifications";
import EmissionsChart from "../components/charts/EmissionsChart";
import MaterialChart from "../components/charts/MaterialChart";
import Card from "../components/ui/Card";
import { Project } from "../types/project";

const DashboardPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCo2, setTotalCo2] = useState(0);
  const [verifiedEntries, setVerifiedEntries] = useState(0);
  const [emissionsByProject, setEmissionsByProject] = useState<{ name: string; emissions: number }[]>([]);
  const [emissionsByMaterial, setEmissionsByMaterial] = useState<{ name: string; value: number }[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [highRiskEntries, setHighRiskEntries] = useState(0);
  const [bimDiscrepancies, setBimDiscrepancies] = useState(0);
  const [pendingSupplierConfirmations, setPendingSupplierConfirmations] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [projectsResponse, notificationsResponse, byProject, byMaterial, byTime, antiCorruption] = await Promise.all([
          fetchProjects(),
          fetchNotifications(),
          fetchEmissionsByProject(),
          fetchEmissionsByMaterial(),
          fetchEmissionsByTime(),
          fetchAntiCorruptionSummary()
        ]);
        setProjects(projectsResponse);
        setPendingApprovals(
          notificationsResponse.filter((notification) => notification.response_type === "NONE").length
        );

        setEmissionsByProject(
          byProject.map((item) => ({
            name: item.project_name,
            emissions: Number(item.emissions.toFixed(2))
          }))
        );
        setEmissionsByMaterial(
          byMaterial.map((item) => ({
            name: item.material_name,
            value: Number(item.emissions.toFixed(2))
          }))
        );
        setTotalCo2(byTime.reduce((sum, point) => sum + point.emissions, 0));
        setVerifiedEntries(notificationsResponse.filter((notification) => notification.response_type !== "NONE").length);
        setHighRiskEntries(antiCorruption.high_risk_entries);
        setBimDiscrepancies(antiCorruption.projects_with_bim_discrepancies);
        setPendingSupplierConfirmations(antiCorruption.entries_pending_supplier_confirmation);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="label-text text-slate-500">Total Projects</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : projects.length}</p>
            <FolderKanban className="h-5 w-5 text-blue-600" />
          </div>
        </Card>
        <Card>
          <p className="label-text text-slate-500">Verified Entries</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : verifiedEntries}</p>
            <CheckCheck className="h-5 w-5 text-emerald-600" />
          </div>
        </Card>
        <Card>
          <p className="label-text text-slate-500">Pending Approvals</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : pendingApprovals}</p>
            <ClipboardList className="h-5 w-5 text-amber-600" />
          </div>
        </Card>
        <Card>
          <p className="label-text text-slate-500">Total CO2 Recorded</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-semibold text-slate-900">
              {isLoading ? "..." : totalCo2.toFixed(2)}
            </p>
            <BarChart3 className="h-5 w-5 text-indigo-600" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="label-text text-slate-500">High Risk Entries</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : highRiskEntries}</p>
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
        </Card>
        <Card>
          <p className="label-text text-slate-500">BIM Discrepancy Projects</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : bimDiscrepancies}</p>
            <GitCompareArrows className="h-5 w-5 text-fuchsia-600" />
          </div>
        </Card>
        <Card>
          <p className="label-text text-slate-500">Pending Supplier Confirmation</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-3xl font-semibold text-slate-900">{isLoading ? "..." : pendingSupplierConfirmations}</p>
            <Truck className="h-5 w-5 text-cyan-600" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Emissions by Project" subtitle="Total calculated emission volume by project.">
          <EmissionsChart data={emissionsByProject} />
        </Card>
        <Card title="Emissions by Material" subtitle="Material contribution to total emissions.">
          <MaterialChart data={emissionsByMaterial} />
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
