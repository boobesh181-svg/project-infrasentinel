import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileImage, Hash, ShieldAlert, GitBranch, Clock3, Truck, FileText, CircleDot } from "lucide-react";
import { format, subDays } from "date-fns";
import OperationsLayout from "../components/layout/OperationsLayout";
import Badge from "../components/ui/Badge";

const seedGroups = () => {
  const plates = ["TN-22-AB-4821", "TN-11-XY-7788", "TN-07-CD-9014", "TN-33-KL-5562"];
  const suppliers = ["Narayana Sand Co.", "Titan Steel", "Acme Aggregates", "Gita Crushers"];
  const materials = ["Cement", "Steel", "Aggregate", "Sand"];
  const verificationStates = ["Invoice Uploaded", "ANPR Verified", "Gross Weight Captured", "Quantity Compared", "Verified"];
  const evidencePaths: Record<string, string[]> = {
    truck: ["/assets/realistic/truck-arrival-1.jpg", "/assets/realistic/truck-arrival-2.jpg", "/assets/realistic/truck-arrival-3.jpg"],
    anpr: ["/assets/realistic/anpr-1.jpg", "/assets/realistic/anpr-2.jpg"],
    invoice: ["/assets/realistic/invoice-1.png", "/assets/realistic/invoice-2.png"],
    weighbridge: ["/assets/realistic/weighbridge-1.jpg", "/assets/realistic/weighbridge-2.jpg"]
  };

  return Array.from({ length: 3 }).map((_, dayIndex) => {
    const date = subDays(new Date(), dayIndex);
    const deliveries = Array.from({ length: 4 + dayIndex }).map((__, index) => {
      const mismatched = dayIndex === 0 && index === 1;
      const plate = plates[(dayIndex + index) % plates.length];
      const supplier = suppliers[(dayIndex + index) % suppliers.length];
      const material = materials[(dayIndex + index) % materials.length];
      const deliveryId = `${format(date, "yyyyMMdd")}-${index}`;
      const time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8 + index, 12 + index * 7);

      return {
        id: deliveryId,
        time,
        plate,
        supplier,
        material,
        state: mismatched ? "Quantity Mismatch" : index % 3 === 0 ? "Verified" : "Processing",
        tons: mismatched ? 16.4 : 18 + index * 1.7,
        expected: mismatched ? 18 : 18 + index * 1.5,
        confidence: mismatched ? 0.84 : 0.92 - index * 0.03,
        anomaly: mismatched,
        invoice: `INV-${format(date, "yy")}-${dayIndex}${index}${index + 3}`,
        evidence: ["truck", "anpr", "invoice", "weighbridge"].slice(0, mismatched ? 4 : 3 + (index % 2)),
        verificationChain: verificationStates.slice(0, mismatched ? 5 : 4 + (index % 2)),
        evidencePaths: {
          truck: evidencePaths.truck[(dayIndex + index) % evidencePaths.truck.length],
          anpr: evidencePaths.anpr[(dayIndex + index) % evidencePaths.anpr.length],
          invoice: evidencePaths.invoice[(dayIndex + index) % evidencePaths.invoice.length],
          weighbridge: evidencePaths.weighbridge[(dayIndex + index) % evidencePaths.weighbridge.length]
        }
      };
    });

    const verifiedTons = deliveries.filter((delivery) => !delivery.anomaly).reduce((sum, delivery) => sum + delivery.tons, 0);
    const activeSuppliers = new Set(deliveries.map((delivery) => delivery.supplier)).size;
    return {
      date,
      deliveries,
      verifiedTons: Math.round(verifiedTons * 10) / 10,
      anomalies: deliveries.filter((delivery) => delivery.anomaly).length,
      activeSuppliers,
      activeInvestigations: deliveries.filter((delivery) => delivery.anomaly).length
    };
  });
};

const evidenceLabel = (kind: string) => {
  switch (kind) {
    case "truck":
      return "truck";
    case "anpr":
      return "anpr";
    case "invoice":
      return "invoice";
    case "weighbridge":
      return "weighbridge";
    default:
      return kind;
  }
};

const evidenceIcon = (kind: string) => {
  switch (kind) {
    case "truck":
      return <Truck className="h-3.5 w-3.5 text-cyan-300" />;
    case "anpr":
      return <CircleDot className="h-3.5 w-3.5 text-cyan-300" />;
    case "invoice":
      return <FileText className="h-3.5 w-3.5 text-cyan-300" />;
    case "weighbridge":
      return <Hash className="h-3.5 w-3.5 text-cyan-300" />;
    default:
      return <FileImage className="h-3.5 w-3.5 text-cyan-300" />;
  }
};

const verificationTone = (state: string) => {
  if (state.includes("Mismatch")) return "border-rose-400/25 bg-rose-500/10 text-rose-100";
  if (state === "Verified") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  return "border-amber-400/20 bg-amber-500/10 text-amber-100";
};

const Timeline = () => {
  const groups = useMemo(() => seedGroups(), []);

  return (
    <OperationsLayout
      kicker="InfraSentinel / Delivery Ledger"
      title="Delivery Ledger"
      badges={["historical ledger", "audit-friendly"]}
    >
      <div className="space-y-4">
        <section className="px-1 py-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Historical delivery verification</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-white">Delivery Ledger — Operational Archive</h1>
              <p className="mt-2 text-xs text-slate-300 max-w-3xl">Chronological infrastructure delivery history with inline proof and audit-grade exports.</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Surface role</p>
              <p className="mt-1 text-xs text-slate-300">Historical delivery record</p>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {groups.map((group) => (
            <section key={format(group.date, "yyyy-MM-dd")} className="relative">
              <div className="absolute left-4 top-0 h-full w-px bg-white/6" />

              <div className="flex items-center justify-between gap-4 py-2 px-3 border-b border-white/6">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{format(group.date, "dd LLL yyyy").toUpperCase()}</p>
                    <p className="text-xs text-slate-300">{group.deliveries.length} deliveries · {group.verifiedTons}T verified · {group.anomalies} anomalies</p>
                  </div>
                </div>
                <div className="text-xs text-slate-400">chronological infrastructure delivery record</div>
              </div>

              <div>
                {group.deliveries.map((delivery, idx) => (
                  <article key={delivery.id} className="relative flex items-center gap-4 px-3 py-2 text-sm leading-none">
                    <div className="absolute left-2 top-0 h-full flex flex-col items-center">
                      <span className={`h-2.5 w-2.5 rounded-full ${delivery.anomaly ? 'bg-rose-400' : 'bg-cyan-400'}`} />
                      {idx < group.deliveries.length - 1 && <span className="mt-1 block h-full w-px bg-white/6" />}
                    </div>

                    <div className="w-28 flex-shrink-0 text-slate-400 text-xs">
                      <div>{format(delivery.time, 'HH:mm')}</div>
                      <div className={`mt-1 text-[11px] ${delivery.anomaly ? 'text-rose-200' : 'text-emerald-200'}`}>{delivery.anomaly ? 'ANOMALY' : delivery.state.toUpperCase()}</div>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <img src={delivery.evidencePaths.truck} alt="truck" className="h-12 w-24 object-cover" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">{delivery.plate}</span>
                          <span className="text-xs text-slate-400 truncate">{delivery.supplier}</span>
                        </div>
                        <div className="text-xs text-slate-300 truncate">{delivery.material} · {delivery.invoice}</div>
                      </div>
                    </div>

                    <div className="w-64 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <img src={delivery.evidencePaths.anpr} alt="anpr" className="h-12 w-20 object-cover" />
                        <img src={delivery.evidencePaths.invoice} alt="inv" className="h-12 w-20 object-cover" />
                        <img src={delivery.evidencePaths.weighbridge} alt="wb" className="h-12 w-20 object-cover" />
                      </div>
                    </div>

                    <div className="w-36 text-right text-xs text-slate-300">
                      <div className="text-white font-medium">{delivery.tons.toFixed(1)}T</div>
                      <div className="text-xs">exp {delivery.expected.toFixed(1)}T</div>
                      <div className="text-xs">conf {Math.round(delivery.confidence*100)}%</div>
                    </div>

                    <div className="w-56 flex-shrink-0 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        {delivery.verificationChain.map((s, i) => (
                          <span key={s + i} className="inline-flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-full ${s.toLowerCase().includes('verified') ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            <span className="truncate">{s}</span>
                            {i < delivery.verificationChain.length - 1 && <span className="text-slate-500">→</span>}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-right">
                        <Link to={`/app/replay?delivery_id=${delivery.id}`} className={`text-[11px] uppercase ${delivery.anomaly ? 'text-rose-300' : 'text-cyan-200'}`}>Investigate</Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </OperationsLayout>
  );
};

export default Timeline;
