import Badge from "../ui/Badge";
import { X, Hash, ShieldCheck, Clock3, FileImage, Camera, MapPin, SunMoon, ScanLine } from "lucide-react";

type Props = {
  open: boolean;
  evidence: any | null;
  onClose: () => void;
};

const EvidenceModal = ({ open, evidence, onClose }: Props) => {
  if (!open || !evidence) return null;

  const previewIsImage = evidence.content_type?.startsWith("image") || evidence.file_type?.startsWith("image");
  const previewIsVideo = evidence.content_type?.startsWith("video") || evidence.file_type?.startsWith("video");
  const siteName = evidence.site_name || evidence.site || "Unknown Site";
  const siteId = evidence.site_id || "SITE-UNK";
  const cameraId = evidence.camera_id || "CAM-UNKNOWN";
  const angle = evidence.camera_angle || "Operational angle";
  const weather = evidence.weather || "Operational";
  const lighting = evidence.lighting || "Daylight";
  const integrity = String(evidence.integrity_status || (evidence.file_hash ? "HASHED" : "UNVERIFIED")).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-6 backdrop-blur-md" onClick={onClose}>
      <div className="operational-panel w-full max-w-6xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Evidence artifact</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">{evidence.file_name}</h3>
              <p className="mt-2 text-sm text-slate-400">Chain-of-custody preview for the current delivery incident.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-100"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge label={(evidence.file_type || evidence.content_type || "UNKNOWN").toUpperCase()} />
            {evidence.uploaded_by ? <Badge label={`UPLOADED BY ${String(evidence.uploaded_by).slice(0, 8)}`} /> : null}
            {evidence.file_hash ? <Badge label={integrity} /> : null}
            <Badge label={previewIsImage ? "IMAGE" : previewIsVideo ? "VIDEO" : "ARTIFACT"} />
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="bg-slate-950 p-6">
            <div className="relative overflow-hidden border border-white/10 bg-black/40">
              {previewIsImage ? (
                <img src={evidence.storage_path} alt={evidence.file_name} className="h-full w-full object-cover" />
              ) : previewIsVideo ? (
                <video className="h-full w-full bg-black" controls src={evidence.storage_path} />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center p-10 text-center text-sm text-slate-400">
                  <FileImage className="mb-4 h-8 w-8 text-cyan-300" />
                  No inline preview is available for this artifact.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/80 p-6 lg:border-l lg:border-t-0">
            <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Metadata</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
                  Uploaded
                </p>
                <p className="mt-2 text-slate-100">{evidence.uploaded_at || "—"}</p>
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/75 to-transparent" />
              <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-100">
                <span className="inline-flex items-center gap-1 border border-cyan-400/20 bg-slate-950/70 px-2 py-1">
                  <Camera className="h-3 w-3 text-cyan-300" />
                  {cameraId}
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 bg-slate-950/70 px-2 py-1">
                  <MapPin className="h-3 w-3 text-cyan-300" />
                  {siteId} · {siteName}
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 bg-slate-950/70 px-2 py-1">
                  <SunMoon className="h-3 w-3 text-cyan-300" />
                  {lighting}
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 bg-slate-950/70 px-2 py-1">
                  <ScanLine className="h-3 w-3 text-cyan-300" />
                  {angle}
                </span>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <Hash className="h-3.5 w-3.5 text-cyan-300" />
                  Hash
                </p>
                <p className="mt-2 break-all text-slate-100">{evidence.file_hash ?? "—"}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  Storage
                </p>
                <p className="mt-2 break-all text-slate-100">{evidence.storage_path ?? "—"}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <FileImage className="h-3.5 w-3.5 text-cyan-300" />
                  Content type
                </p>
                <p className="mt-2 text-slate-100">{evidence.content_type || evidence.file_type || "—"}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <Camera className="h-3.5 w-3.5 text-cyan-300" />
                  Camera / angle
                </p>
                <p className="mt-2 text-slate-100">{cameraId} · {angle}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <SunMoon className="h-3.5 w-3.5 text-cyan-300" />
                  Lighting / weather
                </p>
                <p className="mt-2 text-slate-100">{lighting} · {weather}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceModal;
