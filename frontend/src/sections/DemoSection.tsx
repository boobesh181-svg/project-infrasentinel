const DemoSection = () => {
  return (
    <section id="demo" className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <div className="rounded-[30px] border border-[#cfe0ff] bg-gradient-to-br from-[#0e1e45] via-[#11295d] to-[#0e4788] p-10 text-center shadow-[0_22px_50px_rgba(13,28,62,0.20)]">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8bc4ff]">Request Demo</p>
          <h2 className="font-display mt-4 text-3xl font-bold text-white md:text-4xl">
            See verified climate records in action.
          </h2>
          <p className="mt-4 text-sm text-[#c6ddff]">
            Schedule a walkthrough tailored to your infrastructure portfolio.
          </p>
          <button className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0e234c] transition hover:translate-y-[-1px]">
            Request Demo
          </button>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
