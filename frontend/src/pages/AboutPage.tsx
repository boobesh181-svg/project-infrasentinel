const AboutPage = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">About</p>
          <h1 className="mt-4 text-4xl font-semibold text-white md:text-5xl">
            Infrastructure verification software for operational environments.
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300">
            Infrasentinel is built to support live delivery verification, evidence handling, and audit replay.
            The interface is intentionally restrained: it is designed to look like a deployed control system,
            not a product story.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Primary use", "Delivery verification and incident reconstruction"],
              ["Trust model", "Evidence, timestamps, hashes, operator actions"],
              ["Audience", "Infrastructure, industrial, and enterprise operators"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
                <p className="mt-2 text-sm text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
