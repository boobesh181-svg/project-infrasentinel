import { useEffect, useState } from "react";
import { fetchDuplicateEvidenceEntries, fetchHighRiskEntries } from "../api/antiCorruption";
import Card from "../components/ui/Card";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { DuplicateEvidenceEntry, HighRiskEntry } from "../types/antiCorruption";

const RiskCenterPage = () => {
  const [highRisk, setHighRisk] = useState<HighRiskEntry[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateEvidenceEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const [highRiskEntries, duplicateEntries] = await Promise.all([
          fetchHighRiskEntries(),
          fetchDuplicateEvidenceEntries()
        ]);
        setHighRisk(highRiskEntries);
        setDuplicates(duplicateEntries);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load anti-corruption risk data.");
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-4">
      <Card title="High Risk Entries" subtitle="Entries scored as HIGH by the anti-corruption engine.">
        <Table headers={["Entry", "Material", "Score", "Level", "Generated"]}>
          {highRisk.map((item) => (
            <TableRow key={item.entry_id}>
              <TableCell>{item.entry_id.slice(0, 8)}</TableCell>
              <TableCell>{item.material_name}</TableCell>
              <TableCell>{item.risk_score.toFixed(1)}</TableCell>
              <TableCell>{item.risk_level}</TableCell>
              <TableCell>{new Date(item.generated_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {highRisk.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No high-risk entries.
              </td>
            </TableRow>
          ) : null}
        </Table>
      </Card>

      <Card title="Duplicate Evidence Alerts" subtitle="Evidence hashes reused across projects.">
        <Table headers={["Entry", "Project", "Material", "Status", "Created"]}>
          {duplicates.map((item) => (
            <TableRow key={item.entry_id}>
              <TableCell>{item.entry_id.slice(0, 8)}</TableCell>
              <TableCell>{item.project_id.slice(0, 8)}</TableCell>
              <TableCell>{item.material_name}</TableCell>
              <TableCell>{item.status}</TableCell>
              <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {duplicates.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No duplicate evidence found.
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

export default RiskCenterPage;
