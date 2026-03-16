const DemoSection = () => {
  return (
    <section id="demo" className="bg-mist/80">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="rounded-3xl border border-cloud bg-white p-10 text-center shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-slate">Request Demo</p>
          <h2 className="mt-4 text-3xl font-semibold text-ink">
            See verified climate records in action.
          </h2>
          <p className="mt-4 text-sm text-slate">
            Schedule a walkthrough tailored to your infrastructure portfolio.
          </p>
          <button className="mt-6 rounded-md bg-ink px-6 py-3 text-sm font-semibold text-white">
            Request Demo
          </button>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
