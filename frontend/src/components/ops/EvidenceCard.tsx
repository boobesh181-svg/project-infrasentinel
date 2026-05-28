import { format } from "date-fns";
import { Eye, Hash, ShieldCheck } from "lucide-react";
import Badge from "../ui/Badge";

type Props = {
  evidence: any;
  onOpen?: (evidence: any) => void;
};

const isImage = (evidence: any) => {
  const contentType = String(evidence?.content_type || "").toLowerCase();
  const fileType = String(evidence?.file_type || "").toLowerCase();
  return contentType.startsWith("image/") || fileType.includes("image");
};

const isVideo = (evidence: any) => {
  const contentType = String(evidence?.content_type || "").toLowerCase();
  const fileType = String(evidence?.file_type || "").toLowerCase();
  return contentType.startsWith("video/") || fileType.includes("mp4") || String(evidence?.storage_path || "").toLowerCase().endsWith(".mp4");
};

const EvidenceCard = ({ evidence, onOpen }: Props) => {
  const canPreview = Boolean(evidence?.storage_path && (isImage(evidence) || isVideo(evidence)));

  return (
    <div className="relative w-full flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={() => onOpen?.(evidence)}
        className="relative h-28 w-40 flex-shrink-0 overflow-hidden bg-slate-900/80"
        title={canPreview ? "Open preview" : "Evidence preview"}
      >
        {canPreview ? (
          isVideo(evidence) ? (
            <video src={evidence.storage_path} poster={evidence.poster || undefined} muted playsInline className="h-full w-full object-cover" />
          ) : (
            <img src={evidence.storage_path} alt={evidence.file_name} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-xs uppercase tracking-[0.2em] text-slate-500">{evidence.content_type || evidence.file_type || "evidence"}</div>
        )}

        <div className="absolute left-2 top-2 bg-black/50 px-2 py-1 text-xs text-slate-200">{evidence.camera_id ?? 'CAM-UNKNOWN'}</div>
        <div className="absolute right-2 top-2 bg-black/50 px-2 py-1 text-xs text-slate-200">{format(new Date(evidence.uploaded_at || evidence.uploaded_at || Date.now()), 'yyyy-MM-dd HH:mm')}</div>
        <div className="absolute left-2 bottom-2 inline-flex items-center gap-2 bg-black/60 px-2 py-1 text-xs text-slate-200">
          <Hash className="h-3 w-3 text-cyan-300" />
          <span className="truncate">{String(evidence.file_hash ?? '—').slice(0, 12)}</span>
        </div>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="truncate text-sm font-medium text-white">{evidence.file_name}</h4>
            <p className="mt-1 text-xs text-slate-400">{evidence.site_name ?? evidence.site ?? 'Unknown Site'}</p>
          </div>
          <div className="text-xs text-slate-400">{evidence.content_type || evidence.file_type}</div>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-300">
          <div>Uploaded: {format(new Date(evidence.uploaded_at || Date.now()), 'yyyy-MM-dd HH:mm:ss')}</div>
          <div className="inline-flex items-center gap-1">{evidence.uploaded_by ? <span>By {String(evidence.uploaded_by).slice(0,8)}</span> : null}</div>
          <div className="ml-auto inline-flex items-center gap-2 text-xs text-slate-300">
            <Badge label={evidence.file_hash ? 'HASHED' : 'UNHASHED'} />
            <Badge label="EVIDENCE" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceCard;
