const IMPACTS = [
  {
    title: "Low-carbon adoption",
    detail: "Replace high-emission materials with evidence-backed alternatives."
  },
  {
    title: "Regulatory compliance",
    detail: "Deliver audit-ready records that meet government standards."
  },
  {
    title: "Transparent reporting",
    detail: "Give investors and communities defensible climate disclosures."
  }
];

const ImpactSection = () => {
  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Impact</p>
        <h2 className="mt-4 text-3xl font-semibold text-ink">
          Trusted climate records unlock real decarbonization.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {IMPACTS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-cloud bg-mist/60 p-6">
              <p className="text-lg font-semibold text-ink">{item.title}</p>
              <p className="mt-3 text-sm text-slate">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
