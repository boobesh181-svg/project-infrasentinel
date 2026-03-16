import { motion } from "framer-motion";

const NODES = [
  "Construction Activity",
  "Material Entry",
  "Evidence Upload",
  "Multi-party Attestation",
  "Verification Workflow",
  "Deterministic MRV Report",
  "Verifiable Export Bundle"
];

const ArchitectureDiagram = () => {
  return (
    <div className="mt-10 rounded-3xl border border-cloud bg-white p-8">
      <div className="space-y-4">
        {NODES.map((node, index) => (
          <motion.div
            key={node}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className="flex items-center gap-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cloud bg-mist text-xs font-semibold text-ink">
              {index + 1}
            </span>
            <div className="flex-1 rounded-2xl border border-cloud bg-mist/70 px-5 py-3">
              <p className="text-sm font-semibold text-ink">{node}</p>
            </div>
            {index < NODES.length - 1 ? <span className="h-8 w-px bg-cloud" /> : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
