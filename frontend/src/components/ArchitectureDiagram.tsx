const NODES = [
  "Delivery intake",
  "Evidence capture",
  "AI verification",
  "Operator decision",
  "Audit replay",
  "Export bundle"
];

const ArchitectureDiagram = () => {
  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-6">
      <div className="grid gap-3 md:grid-cols-3">
        {NODES.map((node, index) => (
          <div
            key={node}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 text-xs font-semibold text-cyan-100">
                {index + 1}
            </span>
              <div>
                <p className="text-sm font-medium text-white">{node}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">operational checkpoint</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
