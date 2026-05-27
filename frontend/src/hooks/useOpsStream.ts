import { useEffect, useRef } from "react";

// Simple seeded operational event stream hook. Call with onEvent callback.
// Emits events:
// - arrival
// - anpr
// - weighbridge
// - invoice_uploaded
// - verification_step
// - anomaly_alert
// - operator_action
// - verification_complete

const EVENT_TYPES = [
  "arrival",
  "anpr",
  "weighbridge",
  "invoice_uploaded",
  "verification_step",
  "anomaly_alert",
  "operator_action",
  "verification_complete",
];

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function useOpsStream(onEvent: (e: any) => void, opts?: { enabled?: boolean; seed?: number }) {
  const seed = opts?.seed ?? Date.now();
  const enabled = opts?.enabled ?? true;
  const randRef = useRef(seededRandom(seed));
  const runningRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const rand = randRef.current;

    function makeArrival() {
      const plate = `TN-${Math.floor(rand()*90)+10}-${String.fromCharCode(65 + Math.floor(rand()*26))}${Math.floor(rand()*90)+10}-${Math.floor(rand()*9000)+1000}`;
      const supplierPool = ["Acme Aggregates", "Titan Steel", "Gita Crushers", "Narayana Sand Co.", "Karan Bricks"];
      const materials = ["Cement","Aggregate","Steel","Sand","Fly Ash","Bitumen","Bricks"];
      const supplier = supplierPool[Math.floor(rand()*supplierPool.length)];
      const material = materials[Math.floor(rand()*materials.length)];

      return {
        type: "arrival",
        id: `e-${Date.now()}-${Math.floor(rand()*10000)}`,
        occurred_at: new Date().toISOString(),
        vehicle_plate: plate,
        supplier,
        material,
        project: "Project Alpha",
        site: "Site 01",
        invoice_id: `INV-${Math.floor(rand()*90000)+10000}`,
        expected_quantity: Number((8 + rand()*28).toFixed(2)),
      };
    }

    function emitSequence() {
      const base = makeArrival();
      onEvent(base);
      // schedule follow ups: anpr, weighbridge, invoice, verification sequence
      setTimeout(() => onEvent({ ...base, type: "anpr", anpr_confidence: Number((0.85 + rand()*0.15).toFixed(2)), storage_path: "/assets/realistic/anpr-1.jpg" }), 600 + Math.floor(rand()*900));
      setTimeout(() => onEvent({ ...base, type: "weighbridge", gross: Number((20 + rand()*20).toFixed(2)), tare: Number((1 + rand()*3).toFixed(2)), storage_path: "/assets/realistic/weighbridge-1.jpg" }), 1400 + Math.floor(rand()*1400));
      setTimeout(() => onEvent({ ...base, type: "invoice_uploaded", invoice_id: base.invoice_id, storage_path: "/assets/realistic/invoice-1.png", ocr_confidence: Number((0.75 + rand()*0.25).toFixed(2)) }), 2400 + Math.floor(rand()*2000));

      // verification steps sequence
      const steps = ["detected","processing","invoice_matched","weighbridge_pending","verified"].slice(0, 3 + Math.floor(rand()*3));
      let t = 3200;
      steps.forEach((s,i) => {
        setTimeout(() => onEvent({ ...base, type: "verification_step", step: s, step_index: i }), t);
        t += 800 + Math.floor(rand()*1200);
      });

      // anomaly sometimes
      if (rand() > 0.85) {
        setTimeout(() => onEvent({ ...base, type: "anomaly_alert", anomaly_type: "quantity_mismatch", severity: rand() > 0.95 ? "high" : "medium", explanation: "Detected net differs from invoice." }), t + 400);
      }

      // operator action and completion
      setTimeout(() => onEvent({ ...base, type: "operator_action", operator: "Raman", action: "flagged" }), t + 800);
      setTimeout(() => onEvent({ ...base, type: "verification_complete", result: rand() > 0.9 ? "FLAGGED" : "VERIFIED" }), t + 1400);
    }

    function loop() {
      const delay = 7000 + Math.floor(rand()*15000);
      runningRef.current = window.setTimeout(() => {
        emitSequence();
        loop();
      }, delay);
    }

    loop();

    return () => {
      if (runningRef.current) window.clearTimeout(runningRef.current);
    };
  }, [enabled, onEvent, seed]);
}
