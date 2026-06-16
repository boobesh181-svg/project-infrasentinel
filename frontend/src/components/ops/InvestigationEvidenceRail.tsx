import { useMemo } from "react";
import { Camera, FileText, ScanLine, Truck, Video, Waves, MapPin, CalendarClock, ShieldCheck } from "lucide-react";
import { CheckCircle, Link as LinkIcon, Eye } from "lucide-react";
import ChainOfCustody from "./ChainOfCustody";

type Props = {
  delivery: any | null;
  selectedEvidenceId: string | null;
  activeEventId?: string | null;
  onSelectEvidence: (evidence: any) => void;
  onOpenEvidence: (evidence: any) => void;
  onSyncPlay?: () => void;
};

const iconForEvidence = (type: string) => {
  const normalized = (type || "").toLowerCase();
  if (normalized.startsWith("video/")) return <Video className="h-3.5 w-3.5 text-cyan-300" />;
  if (normalized.includes("invoice") || normalized.includes("pdf") || normalized.includes("text")) return <FileText className="h-3.5 w-3.5 text-cyan-300" />;
  if (normalized.includes("anpr") || normalized.includes("ocr") || normalized.includes("scan")) return <ScanLine className="h-3.5 w-3.5 text-cyan-300" />;
  if (normalized.includes("weigh")) return <Waves className="h-3.5 w-3.5 text-cyan-300" />;
  if (normalized.includes("truck") || normalized.includes("arrival")) return <Truck className="h-3.5 w-3.5 text-cyan-300" />;
  return <Camera className="h-3.5 w-3.5 text-cyan-300" />;
};

const InvestigationEvidenceRail = ({ delivery, selectedEvidenceId, activeEventId, onSelectEvidence, onOpenEvidence, onSyncPlay }: Props) => {
  const evidence = delivery?.evidence ?? [];

  const selectedEvidence = useMemo(
    () => evidence.find((item: any) => item.id === selectedEvidenceId) || evidence[0] || null,
    [evidence, selectedEvidenceId]
  );

  return (
    <section className="operational-panel h-full border border-white/10 bg-slate-950/85 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Evidence rail</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Chain-of-custody evidence</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">Playback-linked artifacts stay synchronized with the reconstruction timeline.</p>
        </div>
        {onSyncPlay ? (
          <button type="button" onClick={onSyncPlay} className="border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
            Sync play
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {evidence.length ? (
          evidence.map((item: any, index: number) => {
            const norm = (() => {
              const fileName = item.file_name || item.fileName || item.id;
              const storage_path = item.storage_path || item.fileName || item.fileNameUrl || item.fileName || (item.fileName ? item.fileName : undefined);
              const content_type = item.content_type || item.file_type || (String(fileName).toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
              return {
                ...item,
                file_name: fileName,
                storage_path,
                content_type,
                camera_id: item.camera_id || item.cameraId || item.cameraId,
                site_id: item.site_id || item.siteId || item.siteId,
                uploaded_at: item.uploaded_at || item.timestamp || item.timestamp
              };
            })();
            const isSelected = selectedEvidence?.id === item.id;
            const isActive = isSelected || activeEventId === item.id;
            const capturedAt = norm.uploaded_at ? new Date(norm.uploaded_at).toLocaleString() : "—";
            const integrity = String(item.integrity_status || (item.hash || item.file_hash ? "HASHED" : "UNVERIFIED")).toUpperCase();
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectEvidence(item)}
                className={`w-full border px-3 py-3 text-left transition ${
                  isActive ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {iconForEvidence(norm.content_type || norm.file_type || norm.file_name)}
                      <p className="truncate text-sm text-white">{norm.file_name || `Evidence ${index + 1}`}</p>
                    </div>
                    <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {norm.content_type || norm.file_type || "artifact"}
                    </p>
                  </div>
                  <span className={`mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] ${isActive ? "text-cyan-100" : "text-slate-400"}`}>
                    {isSelected ? "selected" : activeEventId === item.id ? "active" : "queued"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  <span className="inline-flex items-center gap-1 border border-white/10 bg-black/20 px-2 py-1">
                    <Camera className="h-3 w-3 text-cyan-300" />
                    {norm.camera_id || "camera n/a"}
                  </span>
                  <span className="inline-flex items-center gap-1 border border-white/10 bg-black/20 px-2 py-1">
                    <MapPin className="h-3 w-3 text-cyan-300" />
                    {norm.site_id || "site n/a"} · {norm.site_name || "Unknown Site"}
                  </span>
                  <span className="inline-flex items-center gap-1 border border-white/10 bg-black/20 px-2 py-1">
                    <CalendarClock className="h-3 w-3 text-cyan-300" />
                    {capturedAt}
                  </span>
                  <span className="inline-flex items-center gap-1 border border-white/10 bg-black/20 px-2 py-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-300" />
                    {integrity}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.12em]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/6 bg-slate-900/40 px-2 py-1 text-[10px] text-slate-300">
                      <CheckCircle className="h-3 w-3 text-emerald-300" />
                      {item.chain_of_custody && item.chain_of_custody.captured ? 'Captured' : 'Captured — pending'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/6 bg-slate-900/40 px-2 py-1 text-[10px] text-slate-300">
                      <CheckCircle className="h-3 w-3 text-emerald-300" />
                      {item.chain_of_custody && item.chain_of_custody.verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/6 bg-slate-900/40 px-2 py-1 text-[10px] text-slate-300">
                      <LinkIcon className="h-3 w-3 text-cyan-300" />
                      {item.chain_of_custody && item.chain_of_custody.linked ? 'Linked' : 'Unlinked'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/6 bg-slate-900/40 px-2 py-1 text-[10px] text-slate-300">
                      <Eye className="h-3 w-3 text-amber-300" />
                      {item.chain_of_custody && item.chain_of_custody.reviewed ? 'Reviewed' : 'Not reviewed'}
                    </span>
                  </div>
                </div>
                  <div className="mt-3">
                    <ChainOfCustody coc={item.chain_of_custody || item.coc || { captured: true, verified: Boolean(item.file_hash), linked: Boolean(item.linked), reviewed: Boolean(item.reviewed), captured_at: item.timestamp }} />
                  </div>
              </button>
            );
          })
        ) : (
          <div className="border border-dashed border-white/10 bg-white/4 p-4 text-sm text-slate-400">No evidence is attached to this case yet.</div>
        )}
      </div>

      {selectedEvidence ? (
        <div className="mt-4 border border-white/10 bg-slate-950/70 p-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Selected artifact</p>
          <div className="mt-3 space-y-2">
            {String(selectedEvidence.content_type || "").startsWith("video/") ? (
              <video className="h-40 w-full border border-white/10 object-cover" controls poster={selectedEvidence.poster || undefined} src={selectedEvidence.storage_path} />
            ) : (
              <img
                src={selectedEvidence.storage_path}
                alt={selectedEvidence.file_name || "selected evidence"}
                className="h-40 w-full border border-white/10 object-cover"
              />
            )}
            <div className="space-y-1 text-xs text-slate-300">
              <p className="truncate text-white">{selectedEvidence.file_name}</p>
              <p>Hash: {selectedEvidence.file_hash || "—"}</p>
              <p>Uploaded: {selectedEvidence.uploaded_at || selectedEvidence.timestamp || "—"}</p>
              <p>Camera: {selectedEvidence.camera_id || "—"} · {selectedEvidence.capture_device || selectedEvidence.camera_model || "Operational angle"}</p>
              <p>Location: {selectedEvidence.site_id || "—"} · {selectedEvidence.site_name || "Unknown Site"} {selectedEvidence.gps ? `· ${selectedEvidence.gps.lat.toFixed(5)}, ${selectedEvidence.gps.lon.toFixed(5)}` : ''}</p>
              <p>Integrity: {selectedEvidence.integrity_status || selectedEvidence.integrity || 'UNKNOWN'}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Chain-of-custody:</span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/8 bg-slate-900/30 px-2 py-1 text-[10px] text-slate-300">{selectedEvidence.chain_of_custody && selectedEvidence.chain_of_custody.captured ? 'Captured' : 'Captured — pending'}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/8 bg-slate-900/30 px-2 py-1 text-[10px] text-slate-300">{selectedEvidence.chain_of_custody && selectedEvidence.chain_of_custody.verified ? 'Verified' : 'Unverified'}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/8 bg-slate-900/30 px-2 py-1 text-[10px] text-slate-300">{selectedEvidence.chain_of_custody && selectedEvidence.chain_of_custody.linked ? 'Linked' : 'Unlinked'}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/8 bg-slate-900/30 px-2 py-1 text-[10px] text-slate-300">{selectedEvidence.chain_of_custody && selectedEvidence.chain_of_custody.reviewed ? 'Reviewed' : 'Not reviewed'}</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => onOpenEvidence(selectedEvidence)} className="w-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
              Open evidence
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default InvestigationEvidenceRail;