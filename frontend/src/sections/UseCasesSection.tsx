import UseCaseCards from "../components/UseCaseCards";

const UseCasesSection = () => {
  return (
    <section id="use-cases" className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <p className="text-xs uppercase tracking-[0.24em] text-[#476294]">Use cases</p>
        <h2 className="font-display mt-4 text-3xl font-bold text-[#0b1730] md:text-4xl">
          Built for the full infrastructure chain.
        </h2>
        <UseCaseCards />
      </div>
    </section>
  );
};

export default UseCasesSection;
