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
      <div className="space-y-6">
        <section className="operational-panel rounded-[24px] px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Historical delivery verification</p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">What deliveries happened historically?</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                This surface is an archival delivery ledger: compressed chronology, inline proof, verification states, and anomaly routing only.
              </p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Surface role</p>
              <p className="mt-1 text-sm text-white">Historical delivery record</p>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {groups.map((group) => (
            <section key={format(group.date, "yyyy-MM-dd")} className="relative overflow-hidden border border-white/10 bg-slate-950/82">
              <div className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-cyan-400/35 via-white/8 to-transparent" />
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-4 py-3 md:px-5">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Operational shift</p>
                    <h2 className="mt-1 text-base font-semibold text-white">{format(group.date, "dd LLL yyyy").toUpperCase()}</h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">chronological infrastructure delivery record</p>
                  </div>
                </div>
                <div className="grid gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
                  <span className="border border-white/10 bg-white/5 px-3 py-2">{group.deliveries.length} deliveries</span>
                  <span className="border border-white/10 bg-white/5 px-3 py-2">{group.verifiedTons} tons verified</span>
                  <span className="border border-white/10 bg-white/5 px-3 py-2">{group.anomalies} anomalies</span>
                  <span className="border border-white/10 bg-white/5 px-3 py-2">{group.activeSuppliers} suppliers active</span>
                  <span className="border border-white/10 bg-white/5 px-3 py-2">{group.activeInvestigations} investigations</span>
                </div>
              </div>

              <div className="divide-y divide-white/8">
                {group.deliveries.map((delivery) => (
                  <article key={delivery.id} className="relative px-3 py-2 md:px-4">
                    <div className="absolute left-4 top-0 h-full w-px bg-white/8" />
                    <div className="ml-6 grid w-full items-center gap-3 md:grid-cols-[120px_1fr_220px_160px_120px]">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[11px] text-slate-400">{format(delivery.time, "HH:mm")}</span>
                        <span className={`text-[11px] ${delivery.anomaly ? 'text-rose-200' : 'text-emerald-200'}`}>{delivery.anomaly ? 'ANOMALY' : delivery.state.toUpperCase()}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <img src={delivery.evidencePaths.truck} alt="truck" className="h-12 w-20 rounded-sm object-cover" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-white truncate">{delivery.plate}</span>
                              <span className="text-xs text-slate-400 truncate">{delivery.supplier}</span>
                            </div>
                            <div className="text-xs text-slate-300 truncate">{delivery.material} · Invoice {delivery.invoice}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <img src={delivery.evidencePaths.anpr} alt="anpr" className="h-10 w-16 rounded-sm object-cover" />
                          <img src={delivery.evidencePaths.invoice} alt="inv" className="h-10 w-16 rounded-sm object-cover" />
                          <img src={delivery.evidencePaths.weighbridge} alt="wb" className="h-10 w-16 rounded-sm object-cover" />
                        </div>
                      </div>

                      <div className="text-sm text-white">
                        <div className="text-sm font-medium">{delivery.tons.toFixed(1)}T</div>
                        <div className="text-xs text-slate-400">exp {delivery.expected.toFixed(1)}T</div>
                        <div className="text-xs text-slate-400">conf {Math.round(delivery.confidence*100)}%</div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-slate-300">{delivery.verificationChain.join(' → ')}</div>
                        <Link to={`/app/replay?delivery_id=${delivery.id}`} className={`text-[11px] uppercase tracking-[0.12em] ${delivery.anomaly ? 'text-rose-300' : 'text-cyan-200'}`}>Investigate</Link>
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
