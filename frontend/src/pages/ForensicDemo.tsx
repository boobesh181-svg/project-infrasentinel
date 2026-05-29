import React, { useState } from "react";
import OperationsLayout from "../components/layout/OperationsLayout";
import InvestigationEvidenceRail from "../components/ops/InvestigationEvidenceRail";
import ForensicTimeline from "../components/ops/ForensicTimeline";
import InvestigationReasoningPanel from "../components/ops/InvestigationReasoningPanel";

const makeMockDelivery = () => {
  const id = `demo-1`;
  const plate = `TN-DEMO-0001`;
  const siteName = "Demo Site 03";
  const siteId = "SITE-03";
  const baseTimestamp = new Date("2026-05-29T06:40:11.000Z");
  const dayTs = new Date(baseTimestamp.getTime() - 1000 * 60 * 8);
  const nightTs = new Date(baseTimestamp.getTime() - 1000 * 60 * 3);
  const evidence = [
    {
      id: `${id}-truck`,
      file_name: `${plate}-arrival.jpg`,
      storage_path: "/assets/realistic/truck-arrival-1.jpg",
      content_type: "image/jpeg",
      uploaded_at: dayTs.toISOString(),
      site_name: siteName,
      site_id: siteId,
      camera_id: "CAM-GATE-01",
      camera_angle: "Gate approach",
      lighting: "Daylight",
      weather: "Overcast",
      integrity_status: "HASHED",
      file_hash: "7c2d8f13a9bc",
      operational_note: "Front-left gate capture; truck dust on bumper and lane marker visible."
    },
    {
      id: `${id}-anpr`,
      file_name: `${plate}-anpr.jpg`,
      storage_path: "/assets/realistic/anpr-1.jpg",
      content_type: "image/jpeg",
      uploaded_at: dayTs.toISOString(),
      site_name: siteName,
      site_id: siteId,
      camera_id: "ANPR-01",
      camera_angle: "Overhead plate read",
      lighting: "Daylight",
      weather: "Overcast",
      integrity_status: "HASHED",
      file_hash: "c91f2b0e4d18",
      operational_note: "Plate frame readable; reflective glare is contained."
    },
    {
      id: `${id}-inv`,
      file_name: `INV-DEM-12345.png`,
      storage_path: "/assets/realistic/invoice-1.png",
      content_type: "image/png",
      uploaded_at: nightTs.toISOString(),
      site_name: siteName,
      site_id: siteId,
      camera_id: "UPLOAD-SVC-01",
      camera_angle: "Document capture",
      lighting: "Indoor",
      weather: "N/A",
      integrity_status: "HASHED",
      file_hash: "bb40e6ce19a2",
      supplier_name: "Demo Aggregates",
      invoice_number: "INV-DEM-12345",
      operational_note: "Invoice scan shows clean gridlines and visible stamped header."
    },
    {
      id: `${id}-wb`,
      file_name: `${plate}-weigh.jpg`,
      storage_path: "/assets/realistic/weighbridge-1.jpg",
      content_type: "image/jpeg",
      uploaded_at: nightTs.toISOString(),
      site_name: siteName,
      site_id: siteId,
      camera_id: "WB-01",
      camera_angle: "Scale bridge overhead",
      lighting: "Industrial dusk",
      weather: "Fine dust",
      integrity_status: "HASHED",
      file_hash: "ea23f6cb2d01",
      operational_note: "Truck centered on the scale with operator booth visible."
    },
    {
      id: `${id}-unload`,
      file_name: `${plate}-unload.jpg`,
      storage_path: "/assets/realistic/unloading-1.jpg",
      content_type: "image/jpeg",
      uploaded_at: nightTs.toISOString(),
      site_name: siteName,
      site_id: siteId,
      camera_id: "CAM-UNLOAD-01",
      camera_angle: "Pit side unloading",
      lighting: "Night floodlight",
      weather: "Dry",
      integrity_status: "HASHED",
      file_hash: "0f4c8d92ad77",
      operational_note: "Loader arm engaged with pile edge; wear and material spill visible."
    }
  ];

  return {
    id,
    vehicle_plate: plate,
    supplier: "Demo Aggregates",
    project_name: "Demo Project",
    site_name: siteName,
    site_id: siteId,
    occurred_at: baseTimestamp.toISOString(),
    camera_id: "CAM-GATE-01",
    camera_angle: "Gate approach",
    weather: "Overcast",
    expected_quantity: 18.5,
    detected_quantity: 17.9,
    evidence,
    verification_results: [],
    state: "PROCESSING",
    confidence: 0.88
  };
};

const ForensicDemo = () => {
  const [delivery] = useState(() => makeMockDelivery());
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(delivery.evidence?.[0]?.id || null);
  const [forensicContext, setForensicContext] = useState<any>({});

  return (
    <OperationsLayout kicker="DEV / Forensic Demo" title="Forensic Demo">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <div>
          <InvestigationEvidenceRail
            delivery={delivery}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={(evidence) => setSelectedEvidenceId(evidence.id)}
            onOpenEvidence={(evidence) => {
              if (evidence?.storage_path) window.open(evidence.storage_path, "_blank");
            }}
          />
        </div>

        <div>
          <ForensicTimeline
            delivery={delivery}
            weighbridge={null}
            onOpenEvidence={() => {}}
            onAction={() => {}}
            isSubmitting={false}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={(e: any) => setSelectedEvidenceId(e.id)}
            onContextChange={(ctx: any) => setForensicContext(ctx)}
            enableStream={false}
          />
        </div>

        <div>
          <InvestigationReasoningPanel
            delivery={delivery}
            weighbridge={null}
            selectedEvidence={delivery.evidence.find((e: any) => e.id === selectedEvidenceId) || null}
            activeEvent={forensicContext?.activeEvent || null}
            currentState={forensicContext?.currentState || String(delivery.state).toUpperCase()}
            confidenceSeries={forensicContext?.confidenceSeries || [delivery.confidence]}
            anomalyCount={forensicContext?.anomalyCount || 0}
            operatorCount={forensicContext?.operatorCount || 0}
          />
        </div>
      </div>
    </OperationsLayout>
  );
};

export default ForensicDemo;
