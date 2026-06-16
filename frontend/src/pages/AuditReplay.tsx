import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Camera, FileText, Scale, ShieldAlert, Truck } from "lucide-react";
import OperationsLayout from "../components/layout/OperationsLayout";
import ChainOfCustody from "../components/ops/ChainOfCustody";
import { fetchAuditLogs } from "../api/audit";
import { getDelivery } from "../api/ops";
import { getWeighbridgeByDelivery } from "../api/weighbridge";
import { generateOperationalReport, type OperationalReport } from "../lib/operationalVerificationAssistant";

type CaseStatus = "Open" | "Under Review" | "Resolved" | "Escalated";
type RiskLevel = "Low" | "Medium" | "High" | "Critical";

type EvidenceItem = {
  id?: string;
  type?: string;
  fileName?: string;
  storage_path?: string;
  timestamp?: string;
  siteId?: string;
  anpr?: { plate?: string };
  weighbridge?: { weight?: number; unit?: string };
  invoice?: { id?: string; declaredWeight?: number; unit?: string };
  // enriched metadata
  site_id?: string;
  camera_id?: string;
  camera?: string;
  gps?: { lat: number; lon: number } | null;
  capture_device?: string;
  captureDevice?: string;
  site?: string;
  site_name?: string;
  file_hash?: string;
  hash?: string;
  integrity_status?: string;
  integrity?: string;
  chain_of_custody?: any;
  coc?: any;
  linked?: boolean;
  reviewed?: boolean;
  content_type?: string;
  file_type?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  custodian?: string;
  operator?: string;
};

type AuditReportSection = {
  title: string;
  content: string[];
};

type AuditReportView = {
  generatedAt: string;
  sections: AuditReportSection[];
};

type ExportPackage = {
  packageType: string;
  createdAt: string;
  caseId: string;
  reportTimestamp: string;
  verificationStatus: string;
  evidenceCounts: { total: number; videos: number; images: number; documents: number };
  caseSummary: Record<string, any>;
  auditReport: AuditReportView | null;
  evidenceMetadata: any[];
  chainOfCustody: any[];
  timelineEvents: any[];
  verificationFindings: {
    supporting: string[];
    conflicting: string[];
    evidenceGaps: string[];
    confidence: OperationalReport["confidenceBreakdown"] | null;
    rationale: string | null;
  };
};

const caseTone = (status: CaseStatus) => {
  if (status === "Resolved") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (status === "Escalated") return "border-rose-400/20 bg-rose-500/10 text-rose-100";
  if (status === "Under Review") return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-100";
};

const riskTone = (risk: RiskLevel) => {
  if (risk === "Low") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (risk === "Medium") return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  if (risk === "High") return "border-orange-400/20 bg-orange-500/10 text-orange-100";
  return "border-rose-400/20 bg-rose-500/10 text-rose-100";
};

const formatCompactTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");

const evidenceLabel = (item: EvidenceItem) => {
  if (item.type === "truck-arrival") return "Truck Arrival";
  if (item.type === "anpr") return "ANPR Capture";
  if (item.type === "weighbridge") return "Weighbridge Record";
  if (item.type === "unloading") return "Material Unloading";
  if (item.type === "invoice") return "Invoice Review";
  return item.type || item.id || "Evidence";
};

const fileTitle = (item: EvidenceItem) => item.fileName || item.storage_path || item.id || "Evidence";

const formalRiskLabel = (risk: string) => {
  if (risk === "Critical") return "Critical";
  if (risk === "High") return "High";
  if (risk === "Medium") return "Medium";
  return "Low";
};

const formalStatusLabel = (status: string) => {
  if (status === "Escalated") return "Escalated";
  if (status === "Under Review") return "Under Review";
  if (status === "Resolved") return "Resolved";
  return "Open";
};

const normalizeEvidence = (item: any) => ({
  ...item,
  siteId: item.siteId || item.site_id || item.site || item.site_name,
  site_id: item.site_id || item.siteId || item.site || item.site_name,
  camera_id: item.camera_id || item.cameraId || item.camera,
  camera: item.camera || item.camera_id || item.cameraId,
  timestamp: item.timestamp || item.uploaded_at,
  gps: item.gps || null,
  capture_device: item.capture_device || item.captureDevice || item.device || item.camera_id || item.cameraId,
  file_hash: item.file_hash || item.hash,
  integrity_status: item.integrity_status || item.integrity || (item.file_hash || item.hash ? "VERIFIED" : "UNVERIFIED"),
  chain_of_custody: item.chain_of_custody || item.coc || null,
  content_type: item.content_type || item.file_type,
  file_type: item.file_type || item.content_type,
  uploaded_by: item.uploaded_by || item.custodian,
  linked: item.linked,
  reviewed: item.reviewed
});

const primaryEvidenceForDelivery = (loadedDelivery: any, evidenceItems: EvidenceItem[]) => {
  const anomalyText = String(loadedDelivery?.report?.anomalySeverity || loadedDelivery?.anomaly_data?.anomaly_type || "").toLowerCase();
  const ranked = [...evidenceItems].map((item) => normalizeEvidence(item));
  const byType = (type: string) => ranked.find((item) => String(item.type).toLowerCase().includes(type) || String(item.content_type).toLowerCase().includes(type));

  if (anomalyText.includes("quantity") || anomalyText.includes("mismatch") || anomalyText.includes("weight")) {
    return byType("weighbridge") || byType("invoice") || byType("truck-arrival") || ranked[0] || null;
  }

  if (anomalyText.includes("anpr") || anomalyText.includes("plate") || anomalyText.includes("vehicle")) {
    return byType("anpr") || byType("truck-arrival") || ranked[0] || null;
  }

  if (anomalyText.includes("invoice") || anomalyText.includes("document")) {
    return byType("invoice") || byType("weighbridge") || ranked[0] || null;
  }

  return byType("weighbridge") || ranked[0] || null;
};

const AuditReplay = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("delivery_id") || searchParams.get("id");
  const [delivery, setDelivery] = useState<any | null>(null);
  const [weighbridge, setWeighbridge] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [journal, setJournal] = useState<string[]>([]);
  const [aiFindingsOpen, setAiFindingsOpen] = useState(true);
  const [auditReport, setAuditReport] = useState<AuditReportView | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const loadedDelivery = await getDelivery(id);
        const loadedWeighbridge = await getWeighbridgeByDelivery(id);
        setDelivery(loadedDelivery);
        setWeighbridge(loadedWeighbridge);
        const normalizedEvidence = (loadedDelivery?.evidence || []).map(normalizeEvidence);
        const primaryEvidence = primaryEvidenceForDelivery(loadedDelivery, normalizedEvidence as EvidenceItem[]);
        const anomalyEvidence = normalizedEvidence.find((item: any) => item.id === primaryEvidence?.id) || primaryEvidence || normalizedEvidence[0] || null;
        setSelectedEvidenceId(anomalyEvidence?.id || null);
        setSelectedEvidence(anomalyEvidence);
        setJournal([`Case opened for delivery ${id}.`]);

        const auditEntityType = loadedDelivery?.audit_entity_type || loadedDelivery?.entity_type || (loadedDelivery?.material_entry_id ? "MaterialEntry" : null);
        const auditEntityId = loadedDelivery?.audit_entity_id || loadedDelivery?.material_entry_id || loadedDelivery?.id;
        if (auditEntityType && auditEntityId) {
          try {
            const auditLogs = await fetchAuditLogs(String(auditEntityType), String(auditEntityId));
            if (auditLogs.length) {
              setJournal((current) => [
                ...auditLogs.slice(0, 6).map((log) => `Audit: ${log.action} for ${log.entity_type} ${log.entity_id}.`),
                ...current
              ]);
            }
          } catch {
            // best effort only
          }
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load investigation case.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const evidence: EvidenceItem[] = useMemo(() => (delivery?.evidence ?? []).map(normalizeEvidence), [delivery]);

  const summary = useMemo(() => {
    const truck = delivery?.report?.metadata?.vehicle || delivery?.invoice?.vehicle || delivery?.plate || "—";
    const supplier = delivery?.invoice?.supplier || delivery?.supplier || "—";
    const site = evidence.find((item) => item.siteId)?.siteId || delivery?.site || delivery?.report?.metadata?.site || "—";
    const invoice = delivery?.report?.metadata?.invoiceId || delivery?.invoice?.id || delivery?.invoice || "—";
    const declared = Number(delivery?.report?.metadata?.declaredWeight ?? delivery?.invoice?.declaredWeight ?? 0);
    const measured = Number(delivery?.report?.metadata?.deliveredWeight ?? weighbridge?.weighbridge?.weight ?? delivery?.tons ?? 0);
    const difference = Number((measured - declared).toFixed(1));
    const absDifference = Math.abs(difference);
    const anomalySeverity = String(delivery?.report?.anomalySeverity || "none").toLowerCase();

    let investigationStatus: CaseStatus = "Open";
    if (anomalySeverity === "none" && absDifference < 0.2) investigationStatus = "Resolved";
    else if (anomalySeverity === "critical") investigationStatus = "Escalated";
    else if (anomalySeverity === "moderate" || absDifference >= 1.5) investigationStatus = "Under Review";

    let risk: RiskLevel = "Low";
    if (anomalySeverity === "critical" || absDifference >= 4) risk = "Critical";
    else if (anomalySeverity === "moderate" || absDifference >= 1.5) risk = "High";
    else if (absDifference >= 0.5 || evidence.length < 5) risk = "Medium";

    return {
      truck,
      supplier,
      site,
      invoice,
      declared,
      measured,
      difference,
      risk,
      investigationStatus
    };
  }, [delivery, evidence, weighbridge]);

  const finding = useMemo(() => {
    const discrepancy = Math.abs(summary.difference);
    const whatHappened = discrepancy >= 1.5
      ? `Measured quantity differs from the declared quantity by ${discrepancy.toFixed(1)} ${delivery?.report?.metadata?.unit || delivery?.invoice?.unit || "T"}.`
      : "The delivery record is internally consistent and the evidence chain is complete enough for closure.";
    const whyItMatters = summary.risk === "Low"
      ? "The case can be retained as a closed audit record with low operational risk."
      : "The record may affect payment, receipt confirmation, or formal dispute handling.";
    const recommendedAction = summary.risk === "Low"
      ? "Close the case after standard audit retention."
      : summary.risk === "Medium"
        ? "Review the evidence chain and confirm the quantity before release."
        : summary.risk === "High"
          ? "Escalate to the site manager and retain supporting evidence."
          : "Escalate immediately and freeze the case pending formal investigation.";

    return { whatHappened, whyItMatters, recommendedAction };
  }, [delivery, summary]);

  const supportingEvidence = useMemo(() => {
    const relevantTypes = ["truck-arrival", "anpr", "weighbridge", "invoice", "unloading"];
    return evidence.filter((item) => {
      const type = String(item.type || item.content_type || "").toLowerCase();
      return relevantTypes.some((needle) => type.includes(needle)) && (item.file_hash || item.integrity_status === "VERIFIED" || item.chain_of_custody?.verified);
    });
  }, [evidence]);

  const conflictingEvidence = useMemo(() => {
    return evidence.filter((item) => {
      const type = String(item.type || item.content_type || "").toLowerCase();
      return Boolean(type) && (!item.file_hash || item.integrity_status === "UNVERIFIED" || item.chain_of_custody?.reviewed === false);
    });
  }, [evidence]);

  const operationalReport = useMemo<OperationalReport | null>(() => {
    if (!evidence.length) return null;
    const reportEvidence = evidence.map((item) => ({
      id: item.id,
      type: item.type,
      timestamp: item.timestamp,
      site: item.siteId || item.site_id || item.site || item.site_name,
      camera: item.camera_id || item.camera || item.capture_device,
      fileName: item.fileName,
      fileHash: item.file_hash || item.hash,
      anpr: item.anpr,
      weighbridge: item.weighbridge,
      invoice: item.invoice,
      note: item.integrity_status || item.chain_of_custody?.reviewed ? "verified" : undefined
    }));
    return generateOperationalReport(reportEvidence as any, delivery);
  }, [delivery, evidence]);

  const caseSummary = useMemo(() => {
    const primaryEvidence = selectedEvidence || evidence[0] || null;
    const evidenceCompleteness = evidence.length
      ? Math.round((evidence.filter((item) => item.file_hash || item.integrity_status === "VERIFIED" || item.chain_of_custody?.verified).length / evidence.length) * 100)
      : 0;
    const chainOfCustodyStatus = evidence.length
      ? evidence.every((item) => item.chain_of_custody?.reviewed || item.integrity_status === "VERIFIED")
        ? "Reviewed"
        : evidence.some((item) => item.chain_of_custody?.verified || item.integrity_status === "VERIFIED")
          ? "Linked"
          : "Captured"
      : "Captured";
    const assignedInvestigator =
      delivery?.assigned_investigator ||
      delivery?.report?.metadata?.investigator ||
      (primaryEvidence?.uploaded_by && String(primaryEvidence.uploaded_by).trim()) ||
      (primaryEvidence?.operator === "auto" ? "Auto Verification Analyst" : null) ||
      "Auto Verification Analyst";

    return {
      caseId: delivery?.id || id || "—",
      siteId: evidence.find((item) => item.siteId)?.siteId || delivery?.site || delivery?.report?.metadata?.site || "—",
      supplier: delivery?.report?.metadata?.supplier || delivery?.supplier || delivery?.invoice?.supplier || "—",
      truckId: delivery?.report?.metadata?.vehicle || delivery?.invoice?.vehicle || delivery?.plate || "—",
      invoiceId: delivery?.report?.metadata?.invoiceId || delivery?.invoice?.id || delivery?.invoice || "—",
      declaredQuantity: Number(delivery?.report?.metadata?.declaredWeight ?? delivery?.invoice?.declaredWeight ?? 0),
      measuredQuantity: Number(delivery?.report?.metadata?.deliveredWeight ?? weighbridge?.weighbridge?.weight ?? delivery?.tons ?? 0),
      difference: Number((Number(delivery?.report?.metadata?.deliveredWeight ?? weighbridge?.weighbridge?.weight ?? delivery?.tons ?? 0) - Number(delivery?.report?.metadata?.declaredWeight ?? delivery?.invoice?.declaredWeight ?? 0)).toFixed(1)),
      risk: summary.risk,
      investigationStatus: summary.investigationStatus,
      assignedInvestigator,
      evidenceCompleteness,
      chainOfCustodyStatus
    };
  }, [delivery, evidence, id, selectedEvidence, summary, weighbridge]);

  const reportSource = useMemo(() => {
    if (!operationalReport) return null;
    const summaryData = caseSummary;
    const header = [
      `${summaryData.caseId} | ${summaryData.siteId} | ${summaryData.supplier} | ${summaryData.truckId} | ${summaryData.invoiceId}`,
      `Declared ${summaryData.declaredQuantity.toFixed(1)} T | Measured ${summaryData.measuredQuantity.toFixed(1)} T | Difference ${summaryData.difference > 0 ? "+" : ""}${summaryData.difference.toFixed(1)} T`,
      `Risk ${formalRiskLabel(summaryData.risk)} | Status ${formalStatusLabel(summaryData.investigationStatus)} | Investigator ${summaryData.assignedInvestigator}`,
      `Evidence completeness ${summaryData.evidenceCompleteness}% | Chain of custody ${summaryData.chainOfCustodyStatus}`
    ];

    const sections: AuditReportSection[] = [
      {
        title: "Executive Summary",
        content: [
          operationalReport.operationalSummary,
          operationalReport.finding,
          `Investigation status: ${formalStatusLabel(summaryData.investigationStatus)}. Risk level: ${formalRiskLabel(summaryData.risk)}.`
        ]
      },
      {
        title: "Case Information",
        content: header
      },
      {
        title: "Verification Findings",
        content: [
          operationalReport.discrepancyExplanation,
          `ANPR confidence: ${(operationalReport.confidenceBreakdown.anpr * 100).toFixed(1)}%`,
          `Weighbridge confidence: ${(operationalReport.confidenceBreakdown.weighbridge * 100).toFixed(1)}%`,
          `Invoice confidence: ${(operationalReport.confidenceBreakdown.invoice * 100).toFixed(1)}%`,
          `Aggregate confidence: ${(operationalReport.confidenceBreakdown.aggregate * 100).toFixed(1)}%`
        ]
      },
      {
        title: "Supporting Evidence",
        content: operationalReport.supportingEvidence.length ? operationalReport.supportingEvidence : ["No additional supporting evidence identified."]
      },
      {
        title: "Conflicting Evidence",
        content: operationalReport.conflictingEvidence.length ? operationalReport.conflictingEvidence : ["No conflicting evidence identified."]
      },
      {
        title: "Chain of Custody Summary",
        content: [
          `Captured: ${summaryData.evidenceCompleteness > 0 ? "Yes" : "No"}`,
          `Verified: ${operationalReport.confidenceBreakdown.aggregate >= 0.9 ? "Yes" : "Partial"}`,
          `Linked: ${summaryData.chainOfCustodyStatus !== "Captured" ? "Yes" : "Partial"}`,
          `Reviewed: ${summaryData.chainOfCustodyStatus === "Reviewed" ? "Yes" : "No"}`
        ]
      },
      {
        title: "Quantity Verification",
        content: [
          `Declared quantity: ${summaryData.declaredQuantity.toFixed(1)} T`,
          `Measured quantity: ${summaryData.measuredQuantity.toFixed(1)} T`,
          `Difference: ${summaryData.difference > 0 ? "+" : ""}${summaryData.difference.toFixed(1)} T`,
          `Quantity status: ${summaryData.difference === 0 ? "Matched" : Math.abs(summaryData.difference) <= 0.5 ? "Within tolerance" : "Variance detected"}`
        ]
      },
      {
        title: "Confidence Assessment",
        content: [
          `ANPR: ${(operationalReport.confidenceBreakdown.anpr * 100).toFixed(1)}%`,
          `Weighbridge: ${(operationalReport.confidenceBreakdown.weighbridge * 100).toFixed(1)}%`,
          `Invoice: ${(operationalReport.confidenceBreakdown.invoice * 100).toFixed(1)}%`,
          `Aggregate: ${(operationalReport.confidenceBreakdown.aggregate * 100).toFixed(1)}%`,
          operationalReport.confidenceRationale
        ]
      },
      {
        title: "Recommended Actions",
        content: operationalReport.escalationRecommendation.length ? operationalReport.escalationRecommendation : ["Retain record and monitor."]
      },
      {
        title: "Escalation Recommendation",
        content: [
          `Decision: ${operationalReport.escalationDecision.decision.toUpperCase()}`,
          operationalReport.escalationDecision.justification
        ]
      }
    ];

    return { generatedAt: new Date().toISOString(), sections };
  }, [caseSummary, operationalReport]);

  const generateAuditReport = () => {
    if (!reportSource) return;
    setAuditReport(reportSource);
    setJournal((current) => [`Audit report generated at ${new Date(reportSource.generatedAt).toLocaleString()}.`, ...current].slice(0, 8));
  };

  const exportSource = auditReport || reportSource;

  const exportPackage = useMemo<ExportPackage | null>(() => {
    if (!operationalReport || !exportSource) return null;

    const evidenceMetadata = evidence.map((item) => ({
      id: item.id,
      type: item.type,
      siteId: item.siteId || item.site_id || item.site || item.site_name,
      cameraId: item.camera_id || item.camera || item.capture_device,
      gps: item.gps || null,
      captureDevice: item.capture_device || item.captureDevice || item.camera_id || item.camera,
      timestamp: item.timestamp || item.uploaded_at,
      fileHash: item.file_hash || item.hash,
      integrityStatus: item.integrity_status || item.integrity || (item.file_hash || item.hash ? "VERIFIED" : "UNVERIFIED"),
      chainOfCustody: item.chain_of_custody || item.coc || null,
      operatorAttribution: item.uploaded_by || item.custodian || item.operator || "Auto Verification Analyst"
    }));

    return {
      packageType: "audit-evidence-package",
      createdAt: new Date().toISOString(),
      caseId: caseSummary.caseId,
      reportTimestamp: exportSource.generatedAt,
      verificationStatus: `${formalRiskLabel(caseSummary.risk)} / ${formalStatusLabel(caseSummary.investigationStatus)}`,
      evidenceCounts: {
        total: evidence.length,
        videos: evidence.filter((item) => String(item.content_type || item.file_type || item.fileName || "").toLowerCase().includes("video") || String(item.fileName || "").toLowerCase().endsWith(".mp4")).length,
        images: evidence.filter((item) => String(item.content_type || item.file_type || item.fileName || "").toLowerCase().includes("image") || /\.(png|jpe?g|webp|gif)$/i.test(String(item.fileName || ""))).length,
        documents: evidence.filter((item) => String(item.type || item.content_type || item.file_type || "").toLowerCase().includes("invoice") || String(item.file_type || "").toLowerCase().includes("pdf")).length
      },
      caseSummary,
      auditReport: exportSource,
      evidenceMetadata,
      chainOfCustody: evidenceMetadata.map((item) => ({
        evidenceId: item.id,
        status: item.chainOfCustody?.reviewed ? "Reviewed" : item.chainOfCustody?.linked ? "Linked" : item.chainOfCustody?.verified ? "Verified" : "Captured",
        capturedAt: item.chainOfCustody?.captured_at || item.timestamp,
        verifiedAt: item.chainOfCustody?.verified_at || null,
        linkedAt: item.chainOfCustody?.linked_at || null,
        reviewedAt: item.chainOfCustody?.reviewed_at || null
      })),
      timelineEvents: [
        { label: "Truck Arrival", evidenceId: evidence.find((event) => event.type === "truck-arrival")?.id || null },
        { label: "ANPR Capture", evidenceId: evidence.find((event) => event.type === "anpr")?.id || null },
        { label: "Weighbridge Record", evidenceId: evidence.find((event) => event.type === "weighbridge")?.id || null },
        { label: "Material Unloading", evidenceId: evidence.find((event) => event.type === "unloading")?.id || null },
        { label: "Invoice Review", evidenceId: evidence.find((event) => event.type === "invoice")?.id || null }
      ].map((event) => ({
        ...event,
        status: ((evidence.find((item) => item.id === event.evidenceId) as any)?.chain_of_custody?.reviewed)
          ? "Reviewed"
          : ((evidence.find((item) => item.id === event.evidenceId) as any)?.chain_of_custody?.verified)
            ? "Verified"
            : "Captured"
      })),
      verificationFindings: {
        supporting: operationalReport.supportingEvidence,
        conflicting: operationalReport.conflictingEvidence,
        evidenceGaps: operationalReport.evidenceGaps,
        confidence: operationalReport.confidenceBreakdown,
        rationale: operationalReport.confidenceRationale
      }
    };
  }, [caseSummary, evidence, exportSource, operationalReport]);

  const downloadJson = (payload: ExportPackage) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `infrasentinel-audit-package-${payload.caseId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const buildPrintableReport = (payload: ExportPackage) => {
    const reportData = operationalReport!;
    const sectionHtml = (title: string, lines: string[]) => `
      <section class="section">
        <h2>${title}</h2>
        ${lines.map((line) => `<p>${line || "&nbsp;"}</p>`).join("")}
      </section>
    `;

    const summaryData = payload.caseSummary;
    const reportView = payload.auditReport;
    const confidence = payload.verificationFindings.confidence;

    return `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>InfraSentinel Audit Package ${payload.caseId}</title>
        <style>
          :root { color-scheme: light; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #f8fafc; }
          .page { max-width: 900px; margin: 0 auto; background: white; border: 1px solid #cbd5e1; padding: 28px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
          .eyebrow { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #475569; }
          h1 { margin: 6px 0 8px; font-size: 26px; line-height: 1.2; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; font-size: 12px; margin-top: 14px; }
          .meta div { padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
          .section { page-break-inside: avoid; margin-top: 18px; }
          .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.18em; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; }
          .section p { margin: 0 0 6px; font-size: 12px; line-height: 1.55; }
          .small { font-size: 11px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="eyebrow">InfraSentinel Compliance Evidence Package</div>
            <h1>Audit Package ${payload.caseId}</h1>
            <div class="small">Created ${new Date(payload.createdAt).toLocaleString()}</div>
            <div class="meta">
              <div><strong>Case identifier</strong><br/>${payload.caseId}</div>
              <div><strong>Verification status</strong><br/>${payload.verificationStatus}</div>
              <div><strong>Evidence count</strong><br/>${payload.evidenceCounts.total}</div>
              <div><strong>Report timestamp</strong><br/>${new Date(payload.reportTimestamp).toLocaleString()}</div>
            </div>
          </div>
            ${sectionHtml("Executive Summary", [reportView?.sections.find((section) => section.title === "Executive Summary")?.content.join(" ") || reportData.operationalSummary, `Case status: ${formalStatusLabel(summaryData.investigationStatus)}. Risk level: ${formalRiskLabel(summaryData.risk)}.`])}
          ${sectionHtml("Case Information", [
            `Case ID: ${payload.caseId}`,
            `Site: ${summaryData.siteId}`,
            `Supplier: ${summaryData.supplier}`,
            `Truck: ${summaryData.truckId}`,
            `Invoice: ${summaryData.invoiceId}`
          ])}
          ${sectionHtml("Verification Findings", [
            reportView?.sections.find((section) => section.title === "Verification Findings")?.content.join(" ") || reportData.discrepancyExplanation,
            `ANPR confidence: ${((confidence?.anpr || 0) * 100).toFixed(1)}%`,
            `Weighbridge confidence: ${((confidence?.weighbridge || 0) * 100).toFixed(1)}%`,
            `Invoice confidence: ${((confidence?.invoice || 0) * 100).toFixed(1)}%`,
            `Aggregate confidence: ${((confidence?.aggregate || 0) * 100).toFixed(1)}%`
          ])}
          ${sectionHtml("Supporting Evidence", payload.verificationFindings.supporting.length ? payload.verificationFindings.supporting : ["No additional supporting evidence identified."])}
          ${sectionHtml("Conflicting Evidence", payload.verificationFindings.conflicting.length ? payload.verificationFindings.conflicting : ["No conflicting evidence identified."])}
          ${sectionHtml("Chain of Custody Summary", payload.chainOfCustody.map((item) => `${item.evidenceId || "Evidence"}: ${item.status}${item.capturedAt ? ` · Captured ${new Date(item.capturedAt).toLocaleString()}` : ""}`))}
          ${sectionHtml("Quantity Verification", [
            `Declared quantity: ${summaryData.declaredQuantity.toFixed(1)} T`,
            `Measured quantity: ${summaryData.measuredQuantity.toFixed(1)} T`,
            `Difference: ${summaryData.difference > 0 ? "+" : ""}${summaryData.difference.toFixed(1)} T`
          ])}
          ${sectionHtml("Confidence Assessment", [
            `ANPR: ${((confidence?.anpr || 0) * 100).toFixed(1)}%`,
            `Weighbridge: ${((confidence?.weighbridge || 0) * 100).toFixed(1)}%`,
            `Invoice: ${((confidence?.invoice || 0) * 100).toFixed(1)}%`,
            `Aggregate: ${((confidence?.aggregate || 0) * 100).toFixed(1)}%`,
            payload.verificationFindings.rationale || ""
          ])}
          ${sectionHtml("Recommended Actions", reportData.escalationRecommendation.length ? reportData.escalationRecommendation : ["Retain record and monitor."])}
          ${sectionHtml("Escalation Recommendation", [
            `Decision: ${reportData.escalationDecision.decision.toUpperCase()}`,
            reportData.escalationDecision.justification
          ])}
        </div>
        <script>
          window.onload = () => { window.focus(); window.print(); };
        </script>
      </body>
      </html>`;
  };

  const exportPdf = (payload: ExportPackage) => {
    const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!win) return;
    win.document.open();
    win.document.write(buildPrintableReport(payload));
    win.document.close();
  };

  const handleExportPackage = (format: "json" | "pdf") => {
    if (!exportPackage) return;
    if (format === "json") downloadJson(exportPackage);
    else exportPdf(exportPackage);
    setJournal((current) => [`Audit package exported as ${format.toUpperCase()}.`, ...current].slice(0, 8));
  };

  const timeline = [
    { label: "Truck Arrival", evidence: evidence.find((item) => item.type === "truck-arrival") || evidence[0] },
    { label: "ANPR Capture", evidence: evidence.find((item) => item.type === "anpr") },
    { label: "Weighbridge Record", evidence: evidence.find((item) => item.type === "weighbridge") || (weighbridge ? { id: weighbridge.id, type: "weighbridge", timestamp: weighbridge.timestamp, weighbridge: weighbridge.weighbridge } : undefined) },
    { label: "Material Unloading", evidence: evidence.find((item) => item.type === "unloading") },
    { label: "Invoice Review", evidence: evidence.find((item) => item.type === "invoice") }
  ];

  const openEvidence = (item?: EvidenceItem | null) => {
    if (!item) return;
    setSelectedEvidenceId(item.id || null);
    setSelectedEvidence(item);
    const target = item.storage_path || item.fileName;
    if (target && /^https?:\/\//i.test(target)) {
      window.open(target, "_blank");
    }
    setJournal((current) => [`Opened evidence: ${fileTitle(item)}.`, ...current].slice(0, 8));
  };

  if (!id) {
    return (
      <OperationsLayout kicker="InfraSentinel / Incident Investigation" title="Incident Investigation" badges={["forensic case file", "audit-grade"]}>
        <div className="operational-panel border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-300">
          Select a delivery_id in the URL to open a case file.
        </div>
      </OperationsLayout>
    );
  }

  return (
    <OperationsLayout kicker="InfraSentinel / Incident Investigation" title="Incident Investigation" badges={["forensic case file", "audit-grade"]}>
      <div className="space-y-4">
        <section className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-md md:px-5">
          <div className="grid gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400 lg:grid-cols-[1.2fr_1.3fr_1fr_1fr_1fr_1fr_1fr_1fr]">
            <div>
              <div className="text-slate-500">Case ID</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.caseId}</div>
            </div>
            <div>
              <div className="text-slate-500">Site ID</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.siteId}</div>
            </div>
            <div>
              <div className="text-slate-500">Supplier</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.supplier}</div>
            </div>
            <div>
              <div className="text-slate-500">Truck ID</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.truckId}</div>
            </div>
            <div>
              <div className="text-slate-500">Invoice ID</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.invoiceId}</div>
            </div>
            <div>
              <div className="text-slate-500">Declared / Measured / Diff</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.declaredQuantity.toFixed(1)} T · {caseSummary.measuredQuantity.toFixed(1)} T · {caseSummary.difference > 0 ? "+" : ""}{caseSummary.difference.toFixed(1)} T</div>
            </div>
            <div>
              <div className="text-slate-500">Risk / Status</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.risk} · {caseSummary.investigationStatus}</div>
            </div>
            <div>
              <div className="text-slate-500">Investigator / Evidence / COC</div>
              <div className="mt-1 text-sm font-medium text-white normal-case tracking-normal">{caseSummary.assignedInvestigator} · {caseSummary.evidenceCompleteness}% · {caseSummary.chainOfCustodyStatus}</div>
            </div>
          </div>
        </section>

        <section className="operational-panel px-4 py-4 md:px-5 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                <ShieldAlert className="h-4 w-4 text-cyan-300" />
                forensic case file
                <span className={`border px-3 py-1 ${caseTone(summary.investigationStatus)}`}>{summary.investigationStatus}</span>
                <span className={`border px-3 py-1 ${riskTone(summary.risk)}`}>{summary.risk} risk</span>
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-white md:text-4xl">Incident Investigation</h1>
              <p className="max-w-4xl text-sm leading-6 text-slate-300">A case-first investigation workspace. The file opens with the core facts, shows the AI finding, and exposes the evidence chain in the order it happened.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Case ID</p>
              <p className="text-sm font-medium text-white">{id}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">Loaded {formatCompactTime(delivery?.report?.metadata?.timestamp || evidence?.[0]?.timestamp)}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Case Summary</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ["Truck", summary.truck],
                  ["Supplier", summary.supplier],
                  ["Site", summary.site],
                  ["Invoice", summary.invoice],
                  ["Investigation Status", summary.investigationStatus]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
                    <p className="mt-1 text-sm text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Declared / Measured</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Declared Quantity</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{summary.declared.toFixed(1)} T</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Measured Quantity</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{summary.measured.toFixed(1)} T</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Difference</p>
                  <p className={`mt-2 text-2xl font-semibold ${summary.difference === 0 ? "text-emerald-100" : summary.difference > 0 ? "text-amber-100" : "text-rose-100"}`}>
                    {summary.difference > 0 ? "+" : ""}{summary.difference.toFixed(1)} T
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AI Findings</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => handleExportPackage("json")} className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    Export JSON
                  </button>
                  <button type="button" onClick={() => handleExportPackage("pdf")} className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                    Export PDF
                  </button>
                  <button type="button" onClick={generateAuditReport} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                    Generate Audit Report
                  </button>
                  <button type="button" onClick={() => setAiFindingsOpen((current) => !current)} className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                    {aiFindingsOpen ? "Collapse" : "Open"}
                  </button>
                </div>
              </div>
              <div className={`${aiFindingsOpen ? "mt-4" : "mt-2"} space-y-3 text-sm text-slate-300`}>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">What happened</p>
                  <p className="mt-1 text-white">{finding.whatHappened}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Why it matters</p>
                  <p className="mt-1 text-white">{finding.whyItMatters}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Recommended Action</p>
                  <p className="mt-1 text-white">{finding.recommendedAction}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Supporting evidence</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {supportingEvidence.length ? supportingEvidence.map((item) => <span key={item.id} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">{evidenceLabel(item)}</span>) : <span className="text-slate-400">No verified supporting evidence identified.</span>}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Conflicting evidence</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {conflictingEvidence.length ? conflictingEvidence.map((item) => <span key={item.id} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-100">{evidenceLabel(item)}</span>) : <span className="text-slate-400">No conflicting evidence identified.</span>}
                  </div>
                </div>
              </div>
            </div>

            {auditReport ? (
              <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Audit Report</p>
                    <p className="text-sm text-slate-300">Executive-ready audit finding generated from the current case file.</p>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Generated {new Date(auditReport.generatedAt).toLocaleString()}</p>
                </div>

                <div className="mt-4 space-y-4">
                  {auditReport.sections.map((section, index) => (
                    <section key={section.title} className="border border-white/8 bg-white/4 p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">{section.title}</h3>
                      </div>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                        {section.content.map((line, lineIndex) => (
                          <p key={`${section.title}-${lineIndex}`}>{line}</p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Evidence Timeline</p>
                <p className="text-xs text-slate-500">Click any item to open the associated evidence</p>
              </div>
              <div className="mt-4 space-y-3">
                {timeline.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => openEvidence(item.evidence)}
                    className={`flex w-full items-stretch gap-3 rounded-2xl border px-4 py-3 text-left transition ${selectedEvidenceId && item.evidence?.id === selectedEvidenceId ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/8 bg-white/4 hover:border-cyan-400/20 hover:bg-cyan-500/8"}`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                      {index === 0 ? <Truck className="h-5 w-5" /> : index === 1 ? <Camera className="h-5 w-5" /> : index === 2 ? <Scale className="h-5 w-5" /> : index === 3 ? <ShieldAlert className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {(() => {
                        const evidenceItem = item.evidence as any;
                        return (
                          <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{index + 1}. {item.label}</p>
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{item.evidence ? fileTitle(item.evidence) : "Evidence not available"}</p>
                      {item.evidence ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{evidenceItem?.integrity_status || (evidenceItem?.file_hash ? "VERIFIED" : "UNVERIFIED")}</span>
                          {evidenceItem?.timestamp ? <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{formatCompactTime(evidenceItem.timestamp)}</span> : null}
                        </div>
                      ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Selected Evidence</p>
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/4 p-4">
                {selectedEvidence ? (
                  <>
                    <p className="text-sm font-semibold text-white">{evidenceLabel(selectedEvidence)}</p>
                    <p className="mt-1 text-xs text-slate-400">{fileTitle(selectedEvidence)}</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300">
                      <div>Timestamp: {formatCompactTime(selectedEvidence.timestamp)}</div>
                      <div>Site ID: {selectedEvidence.site_id || selectedEvidence.siteId || selectedEvidence.site_name || '—'}</div>
                      <div>Camera ID: {selectedEvidence.camera_id || selectedEvidence.camera || '—'}</div>
                      <div>GPS: {selectedEvidence.gps ? `${selectedEvidence.gps.lat.toFixed(5)}, ${selectedEvidence.gps.lon.toFixed(5)}` : '—'}</div>
                      <div>Device: {selectedEvidence.capture_device || selectedEvidence.captureDevice || '—'}</div>
                      <div>File hash: {selectedEvidence.file_hash || selectedEvidence.hash || '—'}</div>
                      <div>Integrity: {selectedEvidence.integrity_status || selectedEvidence.integrity || (selectedEvidence.file_hash ? 'VERIFIED' : 'UNVERIFIED')}</div>
                      <div>Evidence type: {selectedEvidence.type || selectedEvidence.content_type || selectedEvidence.file_type || '—'}</div>
                      <div>Uploaded by: {selectedEvidence.uploaded_by || selectedEvidence.custodian || '—'}</div>
                    </div>
                    <div className="mt-3">
                      <ChainOfCustody coc={selectedEvidence.chain_of_custody || selectedEvidence.coc || { captured: true, verified: Boolean(selectedEvidence.file_hash), linked: Boolean(selectedEvidence.linked), reviewed: Boolean(selectedEvidence.reviewed), captured_at: selectedEvidence.timestamp || selectedEvidence.uploaded_at }} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => openEvidence(selectedEvidence)} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100">Open evidence</button>
                      <button type="button" onClick={() => setJournal((current) => [`Selected ${fileTitle(selectedEvidence)}.`, ...current].slice(0, 8))} className="rounded-full border border-white/10 bg-white/4 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">Log selection</button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Select a timeline item to inspect the evidence.</p>
                )}
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Case Notes</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {journal.slice(0, 6).map((entry, index) => (
                  <div key={`${entry}-${index}`} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">{entry}</div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 bg-slate-950/70 p-4 md:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Evidence Summary</p>
              <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Evidence count: {evidence.length}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Investigation status: {summary.investigationStatus}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Risk classification: {summary.risk}</div>
                <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2">Weighbridge: {weighbridge?.weighbridge?.weight ?? delivery?.tons ?? "—"} T</div>
              </div>
            </div>
          </div>
        </section>

        {loading ? <div className="operational-panel border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">Loading case file...</div> : null}
        {error ? <div className="operational-panel border border-rose-400/20 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</div> : null}
      </div>
    </OperationsLayout>
  );
};

export default AuditReplay;