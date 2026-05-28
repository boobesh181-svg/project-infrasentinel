const FLOW_STEPS = [
  "Delivery ingested",
  "Evidence linked",
  "AI checkpoint executed",
  "Operator decision recorded",
  "Replay preserved"
];

const SolutionSection = () => {
  return (
    <section id="workflow" className="border-t border-white/10 bg-slate-950 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl border border-white/10 bg-white/4 p-6 text-slate-100">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Workflow</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">A fixed incident path from ingest to replay.</h2>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {FLOW_STEPS.map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">0{index + 1}</p>
              <p className="mt-2 text-sm font-medium text-white">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
