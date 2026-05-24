const ProblemSection = () => {
  return (
    <section id="problem" className="border-t border-white/10 bg-slate-950 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl rounded-[26px] border border-white/10 bg-white/5 p-6 text-slate-100">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Operational constraint</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Operational records fail when evidence arrives late.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          In infrastructure environments, the problem is not data volume. It is delayed proof, unclear custody, and
          weak reconstruction of what happened during a delivery or verification event.
        </p>
      </div>
    </section>
  );
};

export default ProblemSection;
