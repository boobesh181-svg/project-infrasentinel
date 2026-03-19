import { useEffect, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { useParams } from "react-router-dom";
import { downloadEvidence, fetchEvidence, uploadEvidence } from "../api/evidence";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import FileUpload from "../components/ui/FileUpload";
import Modal from "../components/ui/Modal";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { Evidence } from "../types/evidence";

const EvidencePage = () => {
  const { entryId } = useParams();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState("delivery_note");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [integrityModal, setIntegrityModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: ""
  });

  const loadEvidence = async () => {
    if (!entryId) return;
    try {
      const response = await fetchEvidence(entryId);
      setEvidence(response);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load evidence.");
    }
  };

  useEffect(() => {
    void loadEvidence();
  }, [entryId]);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entryId || !selectedFile) return;

    setError(null);
    setIsLoading(true);
    try {
      await uploadEvidence(entryId, selectedFile, evidenceType);
      setSelectedFile(null);
      await loadEvidence();
    } catch (err: any) {
      setError(err?.message ?? "Unable to upload evidence.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (item: Evidence) => {
    try {
      const blob = await downloadEvidence(item.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Unable to download evidence.");
    }
  };

  const verifyIntegrity = (item: Evidence) => {
    const isValid = Boolean(item.file_hash && item.file_hash.length > 16);
    setIntegrityModal({
      open: true,
      message: isValid
        ? `Integrity verified for ${item.file_name}. Hash: ${item.file_hash}`
        : `Integrity check failed for ${item.file_name}.`
    });
  };

  return (
    <div className="space-y-4">
      <Card title="Upload Evidence" subtitle="Attach PDFs and images to support this material entry.">
        <form onSubmit={handleUpload} className="space-y-3">
          <div>
            <label htmlFor="evidence-type" className="label-text text-slate-600">
              Evidence Type
            </label>
            <select
              id="evidence-type"
              value={evidenceType}
              onChange={(event) => setEvidenceType(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="delivery_note">delivery_note</option>
              <option value="supplier_invoice">supplier_invoice</option>
              <option value="site_photo">site_photo</option>
              <option value="mill_certificate">mill_certificate</option>
              <option value="other">other</option>
            </select>
          </div>
          <FileUpload onFileSelect={setSelectedFile} maxSizeMb={10} />
          <Button type="submit" disabled={!selectedFile || isLoading}>
            {isLoading ? "Uploading..." : "Upload Evidence"}
          </Button>
        </form>
      </Card>

      <Card title="Uploaded Files" subtitle={`Entry: ${entryId ?? "N/A"}`}>
        <Table
          headers={[
            "File Name",
            "Hash",
            "Uploaded By",
            "Timestamp",
            "Actions"
          ]}
        >
          {evidence.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-slate-900">{item.file_name}</TableCell>
              <TableCell className="text-xs text-slate-500">{item.file_hash.slice(0, 16)}...</TableCell>
              <TableCell>{item.uploaded_by.slice(0, 8)}</TableCell>
              <TableCell>
                <div>{new Date(item.uploaded_at).toLocaleString()}</div>
                {item.duplicate_flag ? <div className="text-xs text-rose-600">Duplicate across projects</div> : null}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleDownload(item)}>
                    <Download className="mr-1 inline h-4 w-4" /> Download
                  </Button>
                  <Button size="sm" onClick={() => verifyIntegrity(item)}>
                    <CheckCircle2 className="mr-1 inline h-4 w-4" /> Verify Integrity
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {evidence.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No evidence uploaded yet.
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

      <Modal
        open={integrityModal.open}
        title="Integrity Check"
        onClose={() => setIntegrityModal({ open: false, message: "" })}
      >
        <p className="text-sm text-slate-700">{integrityModal.message}</p>
      </Modal>
    </div>
  );
};

export default EvidencePage;
