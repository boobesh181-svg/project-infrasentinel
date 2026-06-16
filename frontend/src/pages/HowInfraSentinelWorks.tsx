import {
  ArrowRight,
  Camera,
  FileText,
  ScanLine,
  Scale,
  ShieldCheck,
  TriangleAlert,
  Truck,
  Warehouse,
  type LucideIcon
} from "lucide-react";

type WorkflowStep = {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  output: string;
};

const WORKFLOW: WorkflowStep[] = [
  {
    step: "01",
    title: "Truck Arrives At Site",
    description: "Truck enters the monitored zone and the camera captures the vehicle.",
    icon: Truck,
    output: "Vehicle arrival event"
  },
  {
    step: "02",
    title: "ANPR Verification",
    description: "Plate extracted, supplier matched, and a delivery record is opened.",
    icon: ScanLine,
    output: "Identity matched"
  },
  {
    step: "03",
    title: "Weighbridge Verification",
    description: "Gross weight and tare weight are recorded to calculate net material.",
    icon: Scale,
    output: "Net quantity calculated"
  },
  {
    step: "04",
    title: "Material Unloading",
    description: "Unloading activity is captured and time stamped evidence is generated.",
    icon: Warehouse,
    output: "Unloading evidence sealed"
  },
  {
    step: "05",
    title: "Invoice Reconciliation",
    description: "Invoice quantity is compared against weighbridge quantity.",
    icon: FileText,
    output: "Quantity gap measured"
  },
  {
    step: "06",
    title: "AI Verification Engine",
    description: "The engine checks anomalies, quantity mismatches, and missing evidence.",
    icon: TriangleAlert,
    output: "Risk flags generated"
  },
  {
    step: "07",
    title: "Evidence Timeline Creation",
    description: "A chronological evidence chain is built and the delivery record is finalized.",
    icon: Camera,
    output: "Audit-ready ledger"
  },
  {
    step: "08",
    title: "Investigation & Audit Replay",
    description: "Investigators reconstruct events, review evidence, and resolve disputes.",
    icon: ShieldCheck,
    output: "Case replay ready"
  }
];

const SIGNALS = [
  ["Input", "Camera, ANPR, weighbridge, invoice"],
  ["Control", "Match identity, measure weight, check evidence"],
  ["Output", "Delivery record, exception flags, audit replay"]
];

const HowInfraSentinelWorks = () => {
  return (
    <div className="space-y-6 text-slate-100">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl space-y-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">Workflow overview</p>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              How InfraSentinel Works
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              One sequence: identify the truck, verify the weight, capture evidence, reconcile the invoice,
              and preserve the record for audit or dispute review.
            </p>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm md:min-w-[280px]">
            {SIGNALS.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</span>
                <span className="text-right text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.24em] text-slate-400">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
            live capture
          </span>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
            evidence chain
          </span>
          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
            audit replay
          </span>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/75 p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Timeline</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Operational sequence from arrival to replay</h3>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-400 md:flex">
            <ArrowRight className="h-4 w-4 text-cyan-300" />
            left to right / top to bottom
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-[23px] top-6 hidden h-[calc(100%-3rem)] w-px bg-gradient-to-b from-cyan-400/40 via-white/10 to-white/5 md:block" />
          <div className="space-y-4">
            {WORKFLOW.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative grid gap-4 rounded-3xl border border-white/10 bg-white/4 p-4 md:grid-cols-[auto_minmax(0,1fr)_220px] md:items-center md:p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="md:hidden">
                      <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/80">Step {item.step}</p>
                      <h4 className="mt-1 text-lg font-semibold text-white">{item.title}</h4>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="hidden items-center gap-3 md:flex">
                      <p className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/80">Step {item.step}</p>
                      {index < WORKFLOW.length - 1 ? <ArrowRight className="h-4 w-4 text-slate-500" /> : null}
                    </div>
                    <h4 className="mt-2 hidden text-lg font-semibold text-white md:block">{item.title}</h4>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{item.description}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">System output</p>
                    <p className="mt-2 text-sm text-white">{item.output}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Identity", "ANPR and supplier matching establish who the truck belongs to."],
          ["Quantity", "Weighbridge and invoice reconciliation establish what was delivered."],
          ["Proof", "Images, timestamps, and audit logs preserve the chain of custody."]
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-white/10 bg-white/4 p-5">
            <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">{label}</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default HowInfraSentinelWorks;