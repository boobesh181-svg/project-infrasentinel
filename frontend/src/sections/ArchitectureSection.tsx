import ArchitectureDiagram from "../components/ArchitectureDiagram";

const ArchitectureSection = () => {
  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">System architecture</p>
        <h2 className="mt-4 text-3xl font-semibold text-ink">
          A deterministic pipeline from activity to exportable proof.
        </h2>
        <ArchitectureDiagram />
      </div>
    </section>
  );
};

export default ArchitectureSection;
