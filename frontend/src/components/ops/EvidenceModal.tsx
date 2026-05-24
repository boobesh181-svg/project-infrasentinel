import { Fragment } from "react";

type Props = {
  open: boolean;
  evidence: any | null;
  onClose: () => void;
};

const EvidenceModal = ({ open, evidence, onClose }: Props) => {
  if (!open || !evidence) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-w-3xl w-full bg-white rounded p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{evidence.file_name}</h3>
          <button onClick={onClose} className="text-slate-500">Close</button>
        </div>
        <div className="mt-4">
          {evidence.content_type?.startsWith("image") || evidence.file_type?.startsWith("image") ? (
            <img src={evidence.storage_path} alt={evidence.file_name} className="w-full rounded" />
          ) : (
            <video className="w-full rounded" controls src={evidence.storage_path} />
          )}
        </div>
        <div className="mt-3 text-sm text-slate-600">
          <div>Uploaded: {evidence.uploaded_at}</div>
          <div>Hash: {evidence.file_hash ?? "—"}</div>
          <div>Storage: {evidence.storage_path ?? "—"}</div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceModal;
