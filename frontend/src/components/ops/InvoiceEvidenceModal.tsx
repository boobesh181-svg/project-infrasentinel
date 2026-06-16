import { FileImage, FileText, X, CalendarClock, MapPin, Camera, ShieldCheck } from "lucide-react";
import Badge from "../ui/Badge";
import ChainOfCustody from "./ChainOfCustody";

type Props = {
  open: boolean;
  invoice: any | null;
  previewUrl: string | null;
  onClose: () => void;
};

const InvoiceEvidenceModal = ({ open, invoice, previewUrl, onClose }: Props) => {
  if (!open || !invoice) return null;

  const contentType = invoice.content_type || invoice.file_type || "";
  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");
  const isPdf = contentType === "application/pdf";
  const siteName = invoice.site_name || "Unknown Site";
  const siteId = invoice.site_id || "SITE-UNK";
  const cameraId = invoice.camera_id || "UPLOAD-SVC-01";
  const integrity = String(invoice.integrity_status || (invoice.file_hash ? "HASHED" : "UNVERIFIED")).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-md" onClick={onClose}>
      <div className="operational-panel w-full max-w-5xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-white/10 bg-white/5 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Invoice evidence</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">{invoice.file_name}</h3>
              <p className="mt-2 text-sm text-slate-400">Evidence preview for supplier intake and audit replay.</p>
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
            <Badge label={(contentType || "UNKNOWN").toUpperCase()} />
            <Badge label={`HASH ${invoice.file_hash?.slice(0, 8) || "—"}`} />
            <Badge label={integrity} />
            <Badge label={isImage ? "IMAGE" : isPdf ? "PDF" : "DOCUMENT"} />
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="bg-slate-950 p-6">
            <div className="relative overflow-hidden border border-white/10 bg-black/40">
              {previewUrl && isImage ? (
                <img src={previewUrl} alt={invoice.file_name} className="h-full w-full object-cover" />
              ) : previewUrl && isVideo ? (
                <video src={previewUrl} controls className="h-full w-full object-cover" poster={invoice.poster || undefined} />
              ) : previewUrl && isPdf ? (
                <iframe title="Invoice preview" src={previewUrl} className="h-[560px] w-full" />
              ) : (
                <div className="flex min-h-[420px] items-center justify-center p-10 text-center text-sm text-slate-400">
                  {isPdf ? <FileText className="mb-4 h-8 w-8 text-cyan-300" /> : <FileImage className="mb-4 h-8 w-8 text-cyan-300" />}
                  Preview unavailable. Use the download action to review.
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/75 to-transparent" />
              <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-100">
                <span className="inline-flex items-center gap-1 border border-white/10 bg-slate-950/70 px-2 py-1">
                  <Camera className="h-3 w-3 text-cyan-300" />
                  {cameraId}
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 bg-slate-950/70 px-2 py-1">
                  <MapPin className="h-3 w-3 text-cyan-300" />
                  {siteId} · {siteName}
                </span>
                <span className="inline-flex items-center gap-1 border border-white/10 bg-slate-950/70 px-2 py-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-300" />
                  {integrity}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/80 p-6 lg:border-l lg:border-t-0">
            <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Metadata</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Uploaded</p>
                <p className="mt-2 text-slate-100">{new Date(invoice.uploaded_at).toLocaleString()}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Supplier</p>
                <p className="mt-2 text-slate-100">{invoice.supplier_name || "Unknown"}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Invoice ID</p>
                <p className="mt-2 text-slate-100">{invoice.invoice_number || "—"}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  <CalendarClock className="h-3.5 w-3.5 text-cyan-300" />
                  Capture / review
                </p>
                <p className="mt-2 text-slate-100">{invoice.uploaded_at ? new Date(invoice.uploaded_at).toLocaleString() : "—"}</p>
              </div>
              <div className="border border-white/10 bg-white/4 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Chain of custody</p>
                <div className="mt-2">
                  <ChainOfCustody coc={invoice.chain_of_custody || invoice.coc || { captured: true, verified: Boolean(invoice.file_hash), linked: true, reviewed: Boolean(invoice.reviewed), captured_at: invoice.uploaded_at }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceEvidenceModal;
