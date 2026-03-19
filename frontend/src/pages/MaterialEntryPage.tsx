import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  approveEntry,
  createMaterialEntry,
  fetchMaterialEntry,
  lockEntry,
  submitEntry,
  verifyEntry
} from "../api/materialEntries";
import { fetchEntryRisk } from "../api/antiCorruption";
import { fetchEmissionFactors } from "../api/emissionFactors";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { EntryRisk } from "../types/antiCorruption";
import { EmissionFactor } from "../types/emissionFactor";
import { MaterialEntry, MaterialEntryCreate } from "../types/materialEntry";

const MaterialEntryPage = ({ mode }: { mode: "create" | "view" }) => {
  const { projectId, entryId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<MaterialEntry | null>(null);
  const [entryRisk, setEntryRisk] = useState<EntryRisk | null>(null);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState({
    material_name: "",
    quantity: "",
    supplier_name: "",
    supplier_email: "",
    factor_id: ""
  });

  useEffect(() => {
    const loadFactors = async () => {
      try {
        const response = await fetchEmissionFactors();
        setFactors(response);
        if (response.length > 0) {
          setFormState((previous) => ({ ...previous, factor_id: response[0].id }));
        }
      } catch (err: any) {
        setError(err?.message ?? "Unable to load emission factors.");
      }
    };

    if (mode === "create") {
      void loadFactors();
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "view" || !entryId) return;
    const loadEntry = async () => {
      try {
        const [entryResponse, riskResponse] = await Promise.all([
          fetchMaterialEntry(entryId),
          fetchEntryRisk(entryId)
        ]);
        setEntry(entryResponse);
        setEntryRisk(riskResponse);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load entry.");
      }
    };

    void loadEntry();
  }, [entryId, mode]);

  const selectedFactor = useMemo(
    () => factors.find((factor) => factor.id === formState.factor_id) ?? null,
    [factors, formState.factor_id]
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId || !selectedFactor) return;

    setIsLoading(true);
    setError(null);
    try {
      const payload: MaterialEntryCreate = {
        project_id: projectId,
        material_name: formState.material_name,
        quantity: Number(formState.quantity),
        supplier_name: formState.supplier_name || undefined,
        supplier_email: formState.supplier_email || undefined,
        factor_version_snapshot: selectedFactor.version,
        factor_value_snapshot: selectedFactor.factor_value,
        factor_unit_snapshot: selectedFactor.unit,
        factor_source_snapshot: selectedFactor.source
      };
      const response = await createMaterialEntry(payload);
      navigate(`/app/material-entries/${response.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Unable to create entry.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransition = async (action: "submit" | "verify" | "approve" | "lock") => {
    if (!entry) return;
    setError(null);
    setIsLoading(true);
    try {
      const updatedEntry =
        action === "submit"
          ? await submitEntry(entry.id)
          : action === "verify"
          ? await verifyEntry(entry.id)
          : action === "approve"
          ? await approveEntry(entry.id)
          : await lockEntry(entry.id);
      setEntry(updatedEntry);
    } catch (err: any) {
      setError(err?.message ?? "Workflow transition failed.");
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "create") {
    return (
      <div className="space-y-4">
        <Card title="Create Material Entry" subtitle="Capture material quantity and emission factor snapshots.">
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="material-name" className="label-text text-slate-600">
                Material Name
              </label>
              <input
                id="material-name"
                aria-label="Material Name"
                value={formState.material_name}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, material_name: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="material-quantity" className="label-text text-slate-600">
                Quantity
              </label>
              <input
                id="material-quantity"
                type="number"
                min="0"
                step="any"
                aria-label="Quantity"
                value={formState.quantity}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, quantity: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="supplier-name" className="label-text text-slate-600">
                Supplier Name
              </label>
              <input
                id="supplier-name"
                value={formState.supplier_name}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, supplier_name: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="supplier-email" className="label-text text-slate-600">
                Supplier Email
              </label>
              <input
                id="supplier-email"
                type="email"
                value={formState.supplier_email}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, supplier_email: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="material-factor" className="label-text text-slate-600">
                Emission Factor
              </label>
              <select
                id="material-factor"
                aria-label="Emission Factor"
                value={formState.factor_id}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, factor_id: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                {factors.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.material_name} | v{factor.version} | {factor.unit}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Entry"}
              </Button>
            </div>
          </form>
        </Card>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Material Entry" subtitle="Review details and progress through workflow states.">
        {entry ? (
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-sm text-slate-600">
              Material: <span className="font-medium text-slate-900">{entry.material_name}</span>
            </p>
            <p className="text-sm text-slate-600">
              Quantity: <span className="font-medium text-slate-900">{entry.quantity}</span>
            </p>
            <p className="text-sm text-slate-600">
              Supplier: <span className="font-medium text-slate-900">{entry.supplier_name || "-"}</span>
            </p>
            <p className="text-sm text-slate-600">
              Supplier Email: <span className="font-medium text-slate-900">{entry.supplier_email || "-"}</span>
            </p>
            <p className="text-sm text-slate-600">
              Emission Factor: <span className="font-medium text-slate-900">v{entry.factor_version_snapshot}</span>
            </p>
            <p className="text-sm text-slate-600">
              Calculated Emission: <span className="font-medium text-slate-900">{entry.calculated_emission.toFixed(2)}</span>
            </p>
            <p className="text-sm text-slate-600">
              Temporal Anomaly: <span className="font-medium text-slate-900">{entry.temporal_anomaly ? "Yes" : "No"}</span>
            </p>
            <p className="text-sm text-slate-600">
              Audit Required: <span className="font-medium text-slate-900">{entry.audit_required ? "Yes" : "No"}</span>
            </p>
            <p className="text-sm text-slate-600">
              BIM Validation: <span className="font-medium text-slate-900">{entry.bim_validation_status || "PENDING"}</span>
            </p>
            <p className="text-sm text-slate-600">
              BIM Discrepancy Score: <span className="font-medium text-slate-900">{entry.bim_discrepancy_score ?? 0}</span>
            </p>
            <div className="md:col-span-2">
              <Badge label={entry.status} />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">Fraud Risk:</span>
              <Badge label={entryRisk?.risk_level ?? "LOW"} />
              <span className="text-sm font-medium text-slate-900">
                Score {entryRisk?.risk_score ?? 0}
              </span>
            </div>
            {entryRisk && entryRisk.reasons.length > 0 ? (
              <div className="md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Risk Reasons</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {entryRisk.reasons.map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button disabled={entry.status !== "DRAFT" || isLoading} onClick={() => handleTransition("submit")}>
                Submit
              </Button>
              <Button disabled={entry.status !== "SUBMITTED" || isLoading} onClick={() => handleTransition("verify")}>
                Verify
              </Button>
              <Button disabled={entry.status !== "VERIFIED" || isLoading} onClick={() => handleTransition("approve")}>
                Approve
              </Button>
              <Button disabled={entry.status !== "APPROVED" || isLoading} onClick={() => handleTransition("lock")}>
                Lock
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/app/material-entries/${entry.id}/evidence`)}>
                Manage Evidence
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/app/material-entries/${entry.id}/acknowledgements`)}>
                Acknowledgements
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading entry details...</p>
        )}
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default MaterialEntryPage;
