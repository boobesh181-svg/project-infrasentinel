const IMPACTS = [
  {
    title: "Defensible operations",
    detail: "Every decision is tied to evidence, timestamps, and chain-of-custody markers."
  },
  {
    title: "Audit readiness",
    detail: "Replay structures remain exportable for regulators, internal review, and incident reconstruction."
  },
  {
    title: "Operational trust",
    detail: "Operators see confidence, anomalies, and escalation history in one place."
  }
];

const ImpactSection = () => {
  return (
    <section className="border-t border-white/10 bg-slate-950 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl rounded-[26px] border border-white/10 bg-white/5 p-6 text-slate-100">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operational impact</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">The product reduces uncertainty, not just emissions risk.</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {IMPACTS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
