import UseCaseCards from "../components/UseCaseCards";

const UseCasesSection = () => {
  return (
    <section id="use-cases" className="bg-mist/80">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Use cases</p>
        <h2 className="mt-4 text-3xl font-semibold text-ink">
          Built for the full infrastructure chain.
        </h2>
        <UseCaseCards />
      </div>
    </section>
  );
};

export default UseCasesSection;
