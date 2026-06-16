import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronUp, CircleDot, Clock3, FileImage, FileText, GitBranch, Hash, Search, ShieldAlert, Truck, ShieldCheck } from "lucide-react";
import EvidenceCard from "../components/ops/EvidenceCard";
import { format } from "date-fns";
import OperationsLayout from "../components/layout/OperationsLayout";
import { listLocalDeliveries } from "../api/ops";

type LedgerFilter = "verified" | "review" | "discrepancy" | "missing" | "open";

type VerificationStatus = "VERIFIED" | "UNDER REVIEW" | "DISCREPANCY DETECTED";

type LedgerRow = {
  id: string;
  time: string;
  plate: string;
  supplier: string;
  material: string;
  state: string;
  tons: number;
  expected: number;
  confidence: number;
  anomaly: boolean;
  invoice: string;
  evidence: string[];
  evidenceCount: number;
  videoCount: number;
  imageCount: number;
  documentCount: number;
  anomalyCount: number;
  site: string;
};

type DayGroup = {
  key: string;
  label: string;
  rows: LedgerRow[];
};

const FILTERS: Array<{ key: LedgerFilter; label: string }> = [
  { key: "verified", label: "Verified" },
  { key: "review", label: "Under Review" },
  { key: "discrepancy", label: "Discrepancy Detected" },
  { key: "missing", label: "Missing Evidence" },
  { key: "open", label: "Open Investigation" }
];

const placeholderByEvidence: Record<string, string> = {
  arrival: "/assets/realistic/truck-arrival-1.jpg",
  truck: "/assets/realistic/truck-arrival-1.jpg",
  anpr: "/assets/realistic/anpr-1.jpg",
  invoice: "/assets/realistic/invoice-1.png",
  weighbridge: "/assets/realistic/weighbridge-1.jpg",
  video: "/assets/realistic/truck-arrival-1.jpg"
};

const statusTone = (status: VerificationStatus) => {
  if (status === "VERIFIED") return "border-emerald-400/25 bg-emerald-500/15 text-emerald-100";
  if (status === "DISCREPANCY DETECTED") return "border-rose-400/25 bg-rose-500/15 text-rose-100";
  return "border-amber-400/25 bg-amber-500/15 text-amber-100";
};

const verificationStatus = (row: LedgerRow): VerificationStatus => {
  if (row.state === "VERIFIED") return "VERIFIED";
  if (row.anomaly || row.state.includes("FLAGGED") || row.state.includes("MISMATCH")) return "DISCREPANCY DETECTED";
  return "UNDER REVIEW";
};

const evidenceCompletionScore = (row: LedgerRow) => {
  if (row.state === "VERIFIED") return 100;
  if (row.evidenceCount >= 5) return 85;
  if (row.evidenceCount >= 4) return 65;
  return 40;
};

const evidenceAvailability = (score: number) => {
  if (score >= 90) return "Full chain";
  if (score >= 75) return "Substantial chain";
  if (score >= 60) return "Partial chain";
  return "Sparse chain";
};

const chainStatus = (row: LedgerRow) => {
  const status = verificationStatus(row);
  if (status === "VERIFIED") return "Verified chain";
  if (status === "DISCREPANCY DETECTED") return "Needs review";
  return "In progress";
};

const normalizeRows = (rows: any[]): LedgerRow[] =>
  rows
    .map((row: any) => ({
      id: row.id,
      time: row.time,
      plate: row.plate || "UNKNOWN",
      supplier: row.supplier || "Unknown supplier",
      material: row.material || "Aggregate",
      state: row.state || "PROCESSING",
      tons: Number(row.tons || 0),
      expected: Number(row.expected || 0),
      confidence: Number(row.confidence || 0.8),
      anomaly: Boolean(row.anomaly),
      invoice: row.invoice || `${row.id}-INV`,
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
      evidenceCount: Number(row.evidenceCount || 0),
      videoCount: Number(row.videoCount || 0),
      imageCount: Number(row.imageCount || 0),
      documentCount: Number(row.documentCount || 0),
      anomalyCount: Number(row.anomalyCount || 0),
      site: row.site || "SITE-UNKNOWN"
    }))
    .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());

const Timeline = () => {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<LedgerFilter[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const localRows = await listLocalDeliveries();
      setRows(normalizeRows(localRows));
    })();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = [row.id, row.time, row.site, row.plate, row.supplier, row.material, row.invoice, row.state, row.evidence.join(" ")]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !term || searchable.includes(term);
      const matchesFilter =
        activeFilters.length === 0 ||
        activeFilters.every((filter) => {
          switch (filter) {
            case "verified":
              return verificationStatus(row) === "VERIFIED";
            case "review":
              return verificationStatus(row) === "UNDER REVIEW";
            case "discrepancy":
              return verificationStatus(row) === "DISCREPANCY DETECTED";
            case "missing":
              return evidenceCompletionScore(row) < 70;
            case "open":
              return verificationStatus(row) !== "VERIFIED";
            default:
              return true;
          }
        });
      return matchesQuery && matchesFilter;
    });
  }, [activeFilters, query, rows]);

  const groupedRows = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, LedgerRow[]>();
    for (const row of filteredRows) {
      const key = format(new Date(row.time), "yyyy-MM-dd");
      const list = groups.get(key) || [];
      list.push(row);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .map(([key, groupRows]) => ({
        key,
        label: format(new Date(groupRows[0].time), "dd LLL yyyy").toUpperCase(),
        rows: groupRows.sort((left, right) => {
          const severity = (row: LedgerRow) => {
            const status = verificationStatus(row);
            if (status === "DISCREPANCY DETECTED") return 0;
            if (status === "UNDER REVIEW") return 1;
            return 2;
          };

          const diff = severity(left) - severity(right);
          if (diff !== 0) return diff;
          return new Date(right.time).getTime() - new Date(left.time).getTime();
        })
      }))
      .sort((left, right) => right.key.localeCompare(left.key));
  }, [filteredRows]);

  const totals = useMemo(() => {
    const verified = rows.filter((row) => verificationStatus(row) === "VERIFIED").length;
    const underReview = rows.filter((row) => verificationStatus(row) === "UNDER REVIEW").length;
    const discrepancy = rows.filter((row) => verificationStatus(row) === "DISCREPANCY DETECTED").length;
    const missingEvidence = rows.filter((row) => evidenceCompletionScore(row) < 70).length;
    return { verified, underReview, discrepancy, missingEvidence };
  }, [rows]);

  const toggleFilter = (filter: LedgerFilter) => {
    setActiveFilters((current) => (current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]));
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <OperationsLayout kicker="InfraSentinel / Delivery Ledger" title="Delivery Ledger" badges={["operational memory", "audit-ready"]}>
      <div className="space-y-4">
        <section className="operational-panel px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                <Clock3 className="h-4 w-4 text-cyan-300" />
                audit-grade operational memory
                <span className="border border-white/10 bg-white/4 px-3 py-1 text-slate-300">problem rows surface first</span>
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-4xl">Delivery Ledger</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">An auditor should identify the deliveries that need attention within seconds: verification status, evidence completeness, media counts, and the investigate path are visible on every row.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Verified", value: totals.verified, tone: "text-emerald-100" },
                { label: "Under review", value: totals.underReview, tone: "text-amber-100" },
                { label: "Discrepancy detected", value: totals.discrepancy, tone: "text-rose-100" },
                { label: "Missing evidence", value: totals.missingEvidence, tone: "text-cyan-100" }
              ].map((card) => (
                <div key={card.label} className="border border-white/10 bg-slate-950/70 p-3">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
                  <p className={`mt-2 text-3xl font-semibold ${card.tone}`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by truck ID, invoice ID, site, plate, supplier, evidence, or state"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const active = activeFilters.includes(filter.key);
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => toggleFilter(filter.key)}
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
                      active
                        ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-white/4 text-slate-300 hover:border-white/15 hover:bg-white/6"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilters([])}
                  className="rounded-full border border-white/10 bg-white/4 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {groupedRows.map((group) => (
            <section key={group.key} className="relative">
              <div className="absolute left-4 top-0 h-full w-px bg-white/6" />

              <div className="flex items-center justify-between gap-4 border-b border-white/6 px-3 py-2">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{group.label}</p>
                    <p className="text-xs text-slate-300">{group.rows.length} delivery{group.rows.length === 1 ? "" : "ies"}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400">ordered by timestamp</div>
              </div>

              <div className="space-y-2 px-1 py-2">
                {group.rows.map((row) => {
                  const expanded = Boolean(expandedIds[row.id]);
                  const status = verificationStatus(row);
                  const completion = evidenceCompletionScore(row);
                  const availability = evidenceAvailability(completion);
                  const hasInvestigation = status !== "VERIFIED";
                  const chain = chainStatus(row);

                  return (
                    <article key={row.id} className={`border border-white/10 bg-slate-950/60 px-3 py-2.5 transition hover:border-cyan-400/20 border-l-4 ${status === "VERIFIED" ? "border-l-emerald-400/60" : status === "UNDER REVIEW" ? "border-l-amber-400/60" : "border-l-rose-400/60"}`}>
                      <button type="button" onClick={() => toggleExpanded(row.id)} className="flex w-full items-start gap-3 text-left">
                        <div className="flex w-24 shrink-0 flex-col pt-0.5 text-xs text-slate-400">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Timestamp</span>
                          <span className="mt-1 text-sm text-white">{format(new Date(row.time), "HH:mm")}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_0.9fr_auto] lg:items-center">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Site</p>
                                <p className="mt-1 truncate text-sm text-white">{row.site}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Supplier</p>
                                <p className="mt-1 truncate text-sm text-white">{row.supplier}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Truck Number</p>
                                <p className="mt-1 truncate text-sm text-white">{row.plate}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Invoice Number</p>
                                <p className="mt-1 truncate text-sm text-white">{row.invoice}</p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-4">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Verification Status</p>
                              <span className={`mt-2 inline-flex rounded-2xl border px-4 py-3 text-[13px] font-semibold tracking-[0.24em] ${statusTone(status)}`}>
                                {status}
                              </span>
                              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                                <ShieldAlert className={`h-4 w-4 ${status === "VERIFIED" ? "text-emerald-300" : status === "UNDER REVIEW" ? "text-amber-300" : "text-rose-300"}`} />
                                {status === "VERIFIED" ? "Closed for audit retrieval." : status === "UNDER REVIEW" ? "Evidence is incomplete or pending confirmation." : "Exception requires immediate review."}
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Evidence completeness score</p>
                                <p className="mt-1 text-2xl font-semibold text-white">{completion}%</p>
                                <p className="mt-1 text-xs text-slate-400">{availability}</p>
                              </div>
                              <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Evidence media</p>
                                <p className="mt-1 text-sm text-white">{row.videoCount} videos</p>
                                <p className="mt-1 text-xs text-slate-400">{row.imageCount} images · {row.documentCount} documents</p>
                              </div>
                            </div>

                            <div className="flex items-start justify-end pt-2">
                              {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-4">
                            <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Evidence availability</p>
                              <p className="mt-1 text-sm text-white">{availability}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Verification completion</p>
                              <p className="mt-1 text-sm text-white">{completion}% complete</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Chain status</p>
                              <p className="mt-1 text-sm text-white">{chain}</p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Trust signals</p>
                              <p className="mt-1 text-sm text-white">{row.evidenceCount} evidence · {row.videoCount} video{row.videoCount === 1 ? "" : "s"}</p>
                            </div>
                          </div>
                        </div>
                      </button>
                      
                      {expanded && (
                        <div className="mt-3 border-t border-white/8 pt-3">
                          <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr]">
                            <div className="border border-white/8 bg-slate-950/70 p-3">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Attached evidence</div>
                              <div className="mt-3 space-y-2">
                                {(row as any).evidenceDetails && (row as any).evidenceDetails.length ? (
                                  (row as any).evidenceDetails.map((ev: any) => (
                                    <EvidenceCard key={ev.id || ev.file_name} evidence={ev} onOpen={() => {}} />
                                  ))
                                ) : (
                                  <div className="text-sm text-slate-400">No evidence metadata available.</div>
                                )}
                              </div>
                            </div>
                            <EvidencePanel title="Invoice Summary" icon={<FileText className="h-4 w-4 text-cyan-300" />} asset={placeholderByEvidence.invoice} summary={`Invoice reference: ${row.invoice}.`} detail={`Expected quantity: ${row.expected.toFixed(1)}T.`} />
                            <EvidencePanel title="Weighbridge Summary" icon={<Hash className="h-4 w-4 text-cyan-300" />} asset={placeholderByEvidence.weighbridge} summary={`Delivered quantity: ${row.tons.toFixed(1)}T.`} detail={row.anomaly ? "Quantity deviation detected." : "Within expected operating range."} />
                            <div className="border border-white/8 bg-slate-950/70 p-3">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Integrity</div>
                              <div className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                                <div>{(row as any).evidenceDetails && (row as any).evidenceDetails.some((e: any) => e.integrity_status === 'VERIFIED') ? 'Verified evidence present' : 'No verified hash present'}</div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                            <div className="border border-white/8 bg-slate-950/70 p-3">
                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                <GitBranch className="h-4 w-4 text-cyan-300" />
                                Verification Chain
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                {[
                                  { label: "Truck arrival", tone: "bg-cyan-500/10 text-cyan-100" },
                                  { label: "ANPR capture", tone: "bg-cyan-500/10 text-cyan-100" },
                                  { label: "Invoice check", tone: "bg-cyan-500/10 text-cyan-100" },
                                  { label: "Weighbridge validation", tone: "bg-cyan-500/10 text-cyan-100" },
                                  { label: row.anomaly ? "Anomaly detected" : "Verified", tone: row.anomaly ? "bg-rose-500/10 text-rose-100" : "bg-emerald-500/10 text-emerald-100" }
                                ].map((step, index, collection) => (
                                  <span key={step.label} className="inline-flex items-center gap-2">
                                    <span className={`rounded-full border border-white/10 px-2.5 py-1 ${step.tone}`}>{step.label}</span>
                                    {index < collection.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-500" />}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                                <ShieldAlert className="h-4 w-4 text-amber-300" />
                                {row.anomaly ? "Open investigation recommended." : "Record is available for audit retrieval."}
                              </div>
                            </div>

                            <div className="border border-white/8 bg-slate-950/70 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Investigate Action</p>
                                  <p className="mt-1 text-sm text-white">Open the incident workspace with this delivery selected.</p>
                                </div>
                                <Link to={`/app/replay?delivery_id=${row.id}&focus=anomaly`} className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100">
                                  Investigate
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Chain status: {chain}</div>
                                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Evidence count: {row.evidenceCount}</div>
                                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Video count: {row.videoCount}</div>
                                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Image count: {row.imageCount}</div>
                                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Document count: {row.documentCount}</div>
                                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Completion: {completion}%</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {groupedRows.length === 0 && (
            <section className="border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">No deliveries match the current search or filters.</section>
          )}
        </div>
      </div>
    </OperationsLayout>
  );
};

const EvidencePanel = ({
  title,
  icon,
  asset,
  summary,
  detail
}: {
  title: string;
  icon: React.ReactNode;
  asset: string;
  summary: string;
  detail: string;
}) => {
  return (
    <div className="border border-white/8 bg-slate-950/70 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {icon}
        {title}
      </div>
      <img src={asset} alt={title} className="mt-3 h-24 w-full object-cover" />
      <p className="mt-3 text-sm text-white">{summary}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
};

export default Timeline;