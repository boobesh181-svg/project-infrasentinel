import ArchitectureDiagram from "../components/ArchitectureDiagram";

const ArchitectureSection = () => {
  return (
    <section className="bg-[#f4f8ff]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <p className="text-xs uppercase tracking-[0.24em] text-[#476294]">System architecture</p>
        <h2 className="font-display mt-4 text-3xl font-bold text-[#0b1730] md:text-4xl">
          A deterministic pipeline from activity to exportable proof.
        </h2>
        <ArchitectureDiagram />
      </div>
    </section>
  );
};

export default ArchitectureSection;
