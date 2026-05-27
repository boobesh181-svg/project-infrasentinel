import { useEffect, useMemo, useState } from "react";
import { FileUp, ShieldAlert, ShieldCheck } from "lucide-react";
import OperationsLayout from "../components/layout/OperationsLayout";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import InvoiceEvidenceModal from "../components/ops/InvoiceEvidenceModal";
import { downloadInvoice, listInvoices, updateInvoice, uploadInvoice } from "../api/invoices";
import { SupplierInvoice, SupplierInvoiceUpdate } from "../types/invoice";

const confidenceTone = (score: number) => {
  if (score >= 0.85) return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (score >= 0.6) return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  return "border-rose-400/20 bg-rose-500/10 text-rose-100";
};

const InvoiceIntakePage = () => {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formState, setFormState] = useState<SupplierInvoiceUpdate>({});

  const loadInvoices = async (search?: string) => {
    try {
      const response = await listInvoices(search);
      setInvoices(response.items);
      if (response.items.length > 0) {
        setSelectedInvoice(response.items[0]);
      } else {
        setSelectedInvoice(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Unable to load invoices.");
    }
  };

  useEffect(() => {
    void loadInvoices();
  }, []);

  useEffect(() => {
    if (!selectedInvoice) {
      setFormState({});
      return;
    }
    setFormState({
      supplier_name: selectedInvoice.supplier_name ?? "",
      invoice_number: selectedInvoice.invoice_number ?? "",
      material_type: selectedInvoice.material_type ?? "",
      expected_quantity: selectedInvoice.expected_quantity ?? undefined,
      vehicle_number: selectedInvoice.vehicle_number ?? "",
      invoice_timestamp: selectedInvoice.invoice_timestamp ?? null,
      correction_notes: selectedInvoice.correction_notes ?? ""
    });
  }, [selectedInvoice]);

  useEffect(() => {
    if (!previewOpen && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewOpen, previewUrl]);

  const onUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) return;
    setError(null);
    setIsUploading(true);
    try {
      const created = await uploadInvoice(selectedFile);
      setSelectedFile(null);
      await loadInvoices(query);
      setSelectedInvoice(created);
    } catch (err: any) {
      setError(err?.message ?? "Unable to upload invoice.");
    } finally {
      setIsUploading(false);
    }
  };

  const onSave = async () => {
    if (!selectedInvoice) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateInvoice(selectedInvoice.id, {
        supplier_name: formState.supplier_name || null,
        invoice_number: formState.invoice_number || null,
        material_type: formState.material_type || null,
        expected_quantity:
          formState.expected_quantity == null ? null : Number(formState.expected_quantity),
        vehicle_number: formState.vehicle_number || null,
        invoice_timestamp: formState.invoice_timestamp || null,
        correction_notes: formState.correction_notes || null
      });
      setSelectedInvoice(updated);
      await loadInvoices(query);
    } catch (err: any) {
      setError(err?.message ?? "Unable to update invoice.");
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = async () => {
    if (!selectedInvoice) return;
    try {
      const blob = await downloadInvoice(selectedInvoice.id);
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      setError(err?.message ?? "Unable to download invoice.");
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!query.trim()) return invoices;
    const normalized = query.toLowerCase();
    return invoices.filter((invoice) =>
      [invoice.supplier_name, invoice.invoice_number, invoice.vehicle_number, invoice.material_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [invoices, query]);

  const confidence = selectedInvoice?.extraction_confidence || { overall: 0, fields: {} };

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <section className="operational-panel rounded-[30px] px-6 py-6 md:px-7 md:py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Command Center / Invoice Intake</p>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">Supplier Invoice Ingestion</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                Convert supplier invoices into structured verification intelligence. Every upload becomes a traceable delivery record linked to future truck events.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em]">
              <Badge label="OCR ACTIVE" />
              <Badge label="AUDIT READY" />
              <Badge label="EVIDENCE LOCKED" />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card title="Invoice Upload + Extraction" subtitle="Upload supplier bills and validate AI extraction with confidence scoring.">
            <form onSubmit={onUpload} className="space-y-4">
              <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/70 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Upload invoice evidence</p>
                    <p className="text-xs text-slate-400">PDF, PNG, or JPG up to 10MB</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="mt-4 block w-full text-sm text-slate-200"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  aria-label="Upload supplier invoice"
                />
              </div>
              <Button type="submit" disabled={!selectedFile || isUploading}>
                {isUploading ? "Processing..." : "Ingest & Extract"}
              </Button>
            </form>

            {selectedInvoice ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Extraction status</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge label={selectedInvoice.extraction_status} />
                      <Badge label={`CONF ${confidence.overall.toFixed(2)}`} />
                    </div>
                  </div>
                  <Button variant="secondary" onClick={openPreview}>
                    Preview invoice evidence
                  </Button>
                </div>

                {selectedInvoice.extraction_errors.length > 0 ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {selectedInvoice.extraction_errors.join(" · ")}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: "supplier_name", label: "Supplier name" },
                    { key: "invoice_number", label: "Invoice ID" },
                    { key: "material_type", label: "Material type" },
                    { key: "expected_quantity", label: "Expected quantity" },
                    { key: "vehicle_number", label: "Vehicle number" },
                    { key: "invoice_timestamp", label: "Invoice timestamp" }
                  ].map((field) => {
                    const score = confidence.fields?.[field.key] ?? 0;
                    return (
                      <div key={field.key} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{field.label}</label>
                          <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${confidenceTone(score)}`}>
                            {score.toFixed(2)}
                          </span>
                        </div>
                        {field.key === "invoice_timestamp" ? (
                          <input
                            type="datetime-local"
                            value={
                              formState.invoice_timestamp
                                ? new Date(formState.invoice_timestamp).toISOString().slice(0, 16)
                                : ""
                            }
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                invoice_timestamp: event.target.value ? new Date(event.target.value).toISOString() : null
                              }))
                            }
                            className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                            aria-label={field.label}
                          />
                        ) : field.key === "expected_quantity" ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={formState.expected_quantity ?? ""}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                expected_quantity: event.target.value ? Number(event.target.value) : undefined
                              }))
                            }
                            className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                            aria-label={field.label}
                          />
                        ) : (
                          <input
                            value={String((formState as any)[field.key] ?? "")}
                            onChange={(event) => setFormState((prev) => ({ ...prev, [field.key]: event.target.value }))}
                            className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                            aria-label={field.label}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Correction notes</label>
                  <textarea
                    rows={3}
                    value={formState.correction_notes ?? ""}
                    onChange={(event) => setFormState((prev) => ({ ...prev, correction_notes: event.target.value }))}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                    placeholder="Add operator notes for the audit trail"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled={isSaving} onClick={onSave}>
                    {isSaving ? "Saving..." : "Confirm extraction"}
                  </Button>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                    <ShieldCheck className="h-4 w-4" />
                    evidence-linked
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                Upload an invoice to begin extraction and review.
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card title="Invoice History" subtitle="Recent uploads and extraction state." className="h-full">
              <div className="mb-4 flex items-center gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search supplier, invoice, vehicle"
                  className="w-full rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white"
                />
                <Button
                  variant="secondary"
                  onClick={() => void loadInvoices(query)}
                >
                  Search
                </Button>
              </div>

              <div className="space-y-3">
                {filteredInvoices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                    No invoice records yet.
                  </div>
                ) : (
                  filteredInvoices.slice(0, 8).map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => setSelectedInvoice(invoice)}
                      className={`w-full rounded-[22px] border p-4 text-left transition ${
                        selectedInvoice?.id === invoice.id
                          ? "border-cyan-400/25 bg-cyan-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{invoice.supplier_name || "Unknown supplier"}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {invoice.invoice_number || "Invoice"} · {invoice.vehicle_number || "Vehicle"}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge label={invoice.extraction_status} />
                          <p className="mt-2 text-xs text-slate-400">{new Date(invoice.uploaded_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card title="Link Status" subtitle="Delivery events matched to this invoice.">
              {selectedInvoice ? (
                <div className="space-y-3 text-sm text-slate-300">
                  {selectedInvoice.delivery_links.length > 0 ? (
                    selectedInvoice.delivery_links.map((link) => (
                      <div key={link.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Delivery {link.delivery_event_id.slice(0, 8)}</span>
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            {link.match_confidence ? link.match_confidence.toFixed(2) : "—"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{link.match_reason || "heuristic"}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                      No delivery matches yet. This invoice will link as trucks arrive.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                  Select an invoice to view matching deliveries.
                </div>
              )}
            </Card>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100" role="alert">
            <ShieldAlert className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        ) : null}
      </div>

      <InvoiceEvidenceModal
        open={previewOpen}
        invoice={selectedInvoice}
        previewUrl={previewUrl}
        onClose={() => setPreviewOpen(false)}
      />
    </OperationsLayout>
  );
};

export default InvoiceIntakePage;
