import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { downloadEvidence, fetchEvidence, uploadEvidence } from "../api/evidence";
import { Evidence } from "../types/evidence";

const EvidencePage = () => {
  const { entryId } = useParams();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadEvidence = async () => {
    if (!entryId) {
      setError("No material entry selected.");
      return;
    }
    try {
      const data = await fetchEvidence(entryId);
      setEvidence(data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError("Material entry not found. Refresh and select a valid entry.");
      } else {
        setError(err?.message ?? "Unable to load evidence.");
      }
    }
  };

  useEffect(() => {
    void loadEvidence();
  }, [entryId]);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entryId || !file) return;

    setIsLoading(true);
    setError(null);
    try {
      await uploadEvidence(entryId, file);
      setFile(null);
      await loadEvidence();
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError("Material entry not found. Refresh and select a valid entry.");
      } else {
        setError(err?.message ?? "Unable to upload evidence.");
      }
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
      if (err?.response?.status === 404) {
        setError("Evidence file not found. Refresh the list.");
      } else {
        setError(err?.message ?? "Unable to download evidence.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Evidence</p>
        <h2 className="text-2xl font-semibold text-ink">Evidence Repository</h2>
        <p className="mt-2 text-sm text-slate">Material entry: {entryId}</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <form
        onSubmit={handleUpload}
        className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft"
      >
        <p className="text-sm font-semibold text-ink">Upload Evidence</p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <label htmlFor="evidence-upload" className="sr-only">
            Evidence file
          </label>
          <input
            id="evidence-upload"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            disabled={isLoading}
          >
            {isLoading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Evidence Files</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate">{evidence.length} files</p>
        </div>
        <div className="mt-4 space-y-3">
          {evidence.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{item.file_name}</p>
                <p className="text-xs text-slate">
                  Uploaded {new Date(item.uploaded_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDownload(item)}
                className="text-xs font-semibold text-accent"
              >
                Download
              </button>
            </div>
          ))}
          {evidence.length === 0 ? (
            <p className="text-sm text-slate">No evidence uploaded yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EvidencePage;
