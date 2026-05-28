const DemoSection = () => {
  return (
    <section id="demo" className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <div className="border border-[#cfe0ff] bg-slate-950/70 p-10 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8bc4ff]">Demo choreography</p>
          <h2 className="font-display mt-4 text-3xl font-bold text-white md:text-4xl">
            Walkthrough the operational flow in four controlled beats.
          </h2>
          <p className="mt-4 text-sm text-[#c6ddff]">
            Open the command surface, switch to delivery triage, inspect a flagged case, then close with the evidence replay.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-4 text-left">
            {[
              "1. Open command center",
              "2. Route a live delivery",
              "3. Trigger incident investigation",
              "4. Close with operator decision"
            ].map((step) => (
              <div key={step} className="border border-white/10 bg-white/4 p-4 text-sm text-slate-100">
                {step}
              </div>
            ))}
          </div>
          <button className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0e234c] transition hover:translate-y-[-1px]">
            Request Demo
          </button>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
