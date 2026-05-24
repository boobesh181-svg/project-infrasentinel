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

const EvidenceCard = ({ evidence, onOpen }: Props) => {
  const canPreview = Boolean(evidence?.storage_path && isImage(evidence));

  return (
    <article className="group overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/80 shadow-[0_16px_35px_rgba(2,6,23,0.3)] transition hover:border-cyan-400/25 hover:shadow-[0_20px_50px_rgba(2,6,23,0.45)]">
      <div className="flex gap-4 p-3">
        <button
          type="button"
          onClick={() => onOpen?.(evidence)}
          className="relative flex h-28 w-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 text-slate-400 transition group-hover:border-cyan-400/30"
          title={canPreview ? "Open preview" : "Evidence preview"}
        >
          {canPreview ? (
            <img src={evidence.storage_path} alt={evidence.file_name} className="h-full w-full object-cover" />
          ) : (
            <div className="px-3 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
              {evidence.content_type || evidence.file_type || "evidence"}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
            <Eye className="h-3 w-3 text-cyan-300" />
            {canPreview ? "preview" : "artifact"}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="truncate text-sm font-semibold text-white">{evidence.file_name}</h4>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                {evidence.content_type || evidence.file_type || "unknown evidence"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {evidence.file_hash ? <Badge label="HASHED" /> : <Badge label="UNHASHED" />}
              <Badge label="EVIDENCE" />
              {canPreview ? <Badge label="PREVIEW" /> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="uppercase tracking-[0.18em] text-slate-500">Uploaded</p>
              <p className="mt-1 text-slate-200">{format(new Date(evidence.uploaded_at), "yyyy-MM-dd HH:mm:ss")}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="inline-flex items-center gap-1 uppercase tracking-[0.18em] text-slate-500">
                <Hash className="h-3 w-3 text-cyan-300" />
                Hash
              </p>
              <p className="mt-1 truncate text-slate-200">{evidence.file_hash ?? "—"}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            {evidence.uploaded_by ? <span>Uploaded by {String(evidence.uploaded_by).slice(0, 8)}</span> : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              chain marker
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default EvidenceCard;
