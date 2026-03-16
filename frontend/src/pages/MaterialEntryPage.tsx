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
import { fetchEmissionFactors } from "../api/emissionFactors";
import { EmissionFactor } from "../types/emissionFactor";
import { MaterialEntry, MaterialEntryCreate } from "../types/materialEntry";
import WorkflowTimeline from "../components/WorkflowTimeline";

const MaterialEntryPage = ({ mode }: { mode: "create" | "view" }) => {
  const { projectId, entryId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<MaterialEntry | null>(null);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState({
    material_name: "",
    quantity: "",
    factor_id: ""
  });

  useEffect(() => {
    const loadFactors = async () => {
      try {
        const data = await fetchEmissionFactors();
        setFactors(data);
        if (data.length > 0) {
          setFormState((prev) => ({ ...prev, factor_id: data[0].id }));
        }
      } catch (err: any) {
        setError(err?.message ?? "Unable to load emission factors.");
      }
    };
    void loadFactors();
  }, []);

  useEffect(() => {
    if (mode !== "view" || !entryId) return;
    const loadEntry = async () => {
      try {
        const data = await fetchMaterialEntry(entryId);
        setEntry(data);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError("Material entry not found. Refresh the list and try again.");
        } else {
          setError(err?.message ?? "Unable to load material entry.");
        }
      }
    };
    void loadEntry();
  }, [entryId, mode]);

  const selectedFactor = useMemo(
    () => factors.find((factor) => factor.id === formState.factor_id) || null,
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
        factor_version_snapshot: selectedFactor.version,
        factor_value_snapshot: selectedFactor.factor_value,
        factor_unit_snapshot: selectedFactor.unit,
        factor_source_snapshot: selectedFactor.source
      };
      const data = await createMaterialEntry(payload);
      navigate(`/app/material-entries/${data.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Unable to create entry.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransition = async (action: "submit" | "verify" | "approve" | "lock") => {
    if (!entry) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated =
        action === "submit"
          ? await submitEntry(entry.id)
          : action === "verify"
          ? await verifyEntry(entry.id)
          : action === "approve"
          ? await approveEntry(entry.id)
          : await lockEntry(entry.id);
      setEntry(updated);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError("Material entry not found. Refresh the list and try again.");
      } else {
        setError(err?.message ?? "Unable to transition workflow.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "create") {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate">New Entry</p>
          <h2 className="text-2xl font-semibold text-ink">Create Material Entry</h2>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="material-entry-name"
                className="text-xs uppercase tracking-[0.2em] text-slate"
              >
                Material Name
              </label>
              <input
                id="material-entry-name"
                type="text"
                value={formState.material_name}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, material_name: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-cloud bg-white px-4 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label
                htmlFor="material-entry-quantity"
                className="text-xs uppercase tracking-[0.2em] text-slate"
              >
                Quantity
              </label>
              <input
                id="material-entry-quantity"
                type="number"
                min="0"
                step="any"
                value={formState.quantity}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, quantity: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-cloud bg-white px-4 py-2 text-sm"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="material-entry-factor"
                className="text-xs uppercase tracking-[0.2em] text-slate"
              >
                Emission Factor
              </label>
              <select
                id="material-entry-factor"
                value={formState.factor_id}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, factor_id: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-cloud bg-white px-4 py-2 text-sm"
              >
                {factors.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.material_name} - v{factor.version} ({factor.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="mt-6 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Entry"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate">Material Entry</p>
          <h2 className="text-2xl font-semibold text-ink">Entry {entry?.id.slice(0, 8)}</h2>
        </div>
        {entry ? (
          <button
            onClick={() => navigate(`/app/material-entries/${entry.id}/evidence`)}
            className="rounded-md border border-cloud px-4 py-2 text-sm font-semibold text-ink"
          >
            Manage Evidence
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {entry ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
            <p className="text-sm font-semibold text-ink">Entry Details</p>
            <div className="mt-4 space-y-3 text-sm text-slate">
              <p>
                <span className="font-semibold text-ink">Material:</span> {entry.material_name}
              </p>
              <p>
                <span className="font-semibold text-ink">Quantity:</span> {entry.quantity}
              </p>
              <p>
                <span className="font-semibold text-ink">Emission Factor:</span> v
                {entry.factor_version_snapshot} ({entry.factor_unit_snapshot})
              </p>
              <p>
                <span className="font-semibold text-ink">Calculated Emission:</span> {entry.calculated_emission}
              </p>
              <p>
                <span className="font-semibold text-ink">Status:</span> {entry.status}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => handleTransition("submit")}
                disabled={isLoading || entry.status !== "DRAFT"}
                className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Submit
              </button>
              <button
                onClick={() => handleTransition("verify")}
                disabled={isLoading || entry.status !== "SUBMITTED"}
                className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Verify
              </button>
              <button
                onClick={() => handleTransition("approve")}
                disabled={isLoading || entry.status !== "VERIFIED"}
                className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleTransition("lock")}
                disabled={isLoading || entry.status !== "APPROVED"}
                className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Lock
              </button>
            </div>
          </div>
          <WorkflowTimeline status={entry.status} />
        </div>
      ) : (
        <p className="text-sm text-slate">Loading material entry...</p>
      )}
    </div>
  );
};

export default MaterialEntryPage;
