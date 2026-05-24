import ArchitectureDiagram from "../components/ArchitectureDiagram";

const ArchitectureSection = () => {
  return (
    <section className="border-t border-white/10 bg-slate-950 px-6 py-12">
      <div className="mx-auto w-full max-w-6xl rounded-[26px] border border-white/10 bg-white/5 p-6 text-slate-100">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">System architecture</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">A deterministic pipeline from ingest to exportable proof.</h2>
        <ArchitectureDiagram />
      </div>
    </section>
  );
};

export default ArchitectureSection;
