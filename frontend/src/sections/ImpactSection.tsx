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
    <section className="bg-[#f4f8ff]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <p className="text-xs uppercase tracking-[0.24em] text-[#476294]">Impact</p>
        <h2 className="font-display mt-4 text-3xl font-bold text-[#0b1730] md:text-4xl">
          Trusted climate records unlock real decarbonization.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {IMPACTS.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#d9e5fb] bg-white p-6 shadow-[0_10px_24px_rgba(20,40,90,0.08)]">
              <p className="text-lg font-semibold text-[#12274e]">{item.title}</p>
              <p className="mt-3 text-sm text-[#4b628f]">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
