import { format } from "date-fns";
import { Eye, Hash, ShieldCheck, CalendarClock, Camera, MapPin, SunMoon, ShieldAlert } from "lucide-react";
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
  const capturedAt = evidence?.uploaded_at ? format(new Date(evidence.uploaded_at), "yyyy-MM-dd HH:mm") : "—";
  const integrity = String(evidence?.integrity_status || (evidence?.file_hash ? "HASHED" : "UNVERIFIED")).toUpperCase();
  const weather = evidence?.weather || "Operational";
  const lighting = evidence?.lighting || "Daylight";
  const angle = evidence?.camera_angle || "Operational angle";
  const siteName = evidence?.site_name || evidence?.site || "Unknown Site";
  const siteId = evidence?.site_id || evidence?.site_code || "SITE-UNK";

  return (
    <div className="relative flex w-full items-center gap-3 py-2">
      <button
        type="button"
        onClick={() => onOpen?.(evidence)}
        className="relative h-28 w-40 flex-shrink-0 overflow-hidden border border-white/10 bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
        title={canPreview ? "Open preview" : "Evidence preview"}
      >
        {canPreview ? (
          isVideo(evidence) ? (
            <video src={evidence.storage_path} poster={evidence.poster || undefined} muted playsInline className="h-full w-full object-cover" />
          ) : (
            <img src={evidence.storage_path} alt={evidence.file_name} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(2,6,23,0.95))] px-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            {evidence.content_type || evidence.file_type || "evidence"}
          </div>
        )}

        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-950/80 to-transparent" />
        <div className="absolute left-2 top-2 inline-flex items-center gap-2 border border-cyan-400/20 bg-slate-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
          <Camera className="h-3 w-3 text-cyan-300" />
          {evidence.camera_id ?? "CAM-UNKNOWN"}
        </div>
        <div className="absolute right-2 top-2 inline-flex items-center gap-2 border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
          <CalendarClock className="h-3 w-3 text-cyan-300" />
          {capturedAt}
        </div>
        <div className="absolute left-2 bottom-2 right-2 space-y-1">
          <div className="inline-flex max-w-full items-center gap-2 border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
            <MapPin className="h-3 w-3 text-cyan-300" />
            <span className="truncate">{siteId} · {siteName}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-200">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/75 px-2 py-1">
              <SunMoon className="h-3 w-3 text-cyan-300" />
              {lighting}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/75 px-2 py-1">
              <ShieldCheck className="h-3 w-3 text-emerald-300" />
              {integrity}
            </span>
          </div>
        </div>
        <div className="absolute right-2 bottom-2 inline-flex items-center gap-2 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
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

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <div>Uploaded: {format(new Date(evidence.uploaded_at || Date.now()), 'yyyy-MM-dd HH:mm:ss')}</div>
          <div className="inline-flex items-center gap-1">{evidence.uploaded_by ? <span>By {String(evidence.uploaded_by).slice(0,8)}</span> : null}</div>
          <div className="ml-auto inline-flex items-center gap-2 text-xs text-slate-300">
            <Badge label={evidence.file_hash ? 'HASHED' : 'UNHASHED'} />
            <Badge label="EVIDENCE" />
            <Badge label={angle} />
            <Badge label={weather} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceCard;
