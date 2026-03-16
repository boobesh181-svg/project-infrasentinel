import { motion } from "framer-motion";

const STEPS = [
  "Activity Recorded",
  "Evidence Attached",
  "Stakeholders Notified",
  "Verified",
  "Immutable Record"
];

const WorkflowDiagram = () => {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {STEPS.map((step, index) => (
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, delay: index * 0.08 }}
          className="rounded-2xl border border-cloud bg-mist/70 p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-slate">{index + 1}</p>
            <span className="h-2 w-2 rounded-full bg-accent" />
          </div>
          <p className="mt-4 text-sm font-semibold text-ink">{step}</p>
          <div className="mt-4 h-1 w-full rounded-full bg-cloud">
            <motion.div
              className="h-1 rounded-full bg-ink"
              initial={{ width: 0 }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default WorkflowDiagram;
