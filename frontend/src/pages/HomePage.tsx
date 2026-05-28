const HomePage = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-slate-950/80">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[1.25fr_0.75fr] lg:py-20">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100">
              Operational system
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
              Infrastructure verification command software.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Infrasentinel is already structured for live deliveries, verification, evidence, audit replay, and operator escalation.
              The public surface exists only to orient deployment; the product lives in the command center.
            </p>

            <div className="flex flex-wrap gap-3">
              <a href="/login" className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25">
                Open command center
                <span aria-hidden>→</span>
              </a>
              <a href="/app/replay" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
                View audit replay
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Primary workflow", value: "Delivery → verification → replay" },
                { label: "Operating mode", value: "Live, evidence-first" },
                { label: "Deployment posture", value: "Production-shaped" }
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-slate-900/80 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deployment posture</p>
            <div className="mt-4 space-y-3">
              {[
                ["Verification lane", "Enabled"],
                ["Evidence chain", "Persisted"],
                ["Audit replay", "Available"],
                ["Operator console", "Active"]
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className="text-sm font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Designed to feel already deployable, not aspirational.
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-slate-950/60">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-8 md:grid-cols-4">
          {[
            ["Command center", "Live queue, anomalies, and operator actions."],
            ["Delivery verification", "One incident lane from ingest to decision."],
            ["Audit replay", "Evidence-backed reconstruction of every transition."],
            ["Deployment ready", "Structured for enterprise and government environments."]
          ].map(([title, detail]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="border border-white/10 bg-white/4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operational summary</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">The product is the workflow.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Every screen exists to support delivery verification, anomaly detection, evidence capture, and forensic replay.
            </p>
          </div>
          <div className="border border-white/10 bg-white/4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operational trust</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Evidence stays visible.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Chain-of-custody markers, timestamps, confidence transitions, and operator actions are surfaced together.
            </p>
          </div>
          <div className="border border-white/10 bg-white/4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deployment note</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Already shaped for operations.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The public-facing content stays minimal so the command center feels authoritative and immediate.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
