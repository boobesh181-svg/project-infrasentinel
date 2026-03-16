import { motion } from "framer-motion";

const FLOW_STEPS = [
  "Activity Recorded",
  "Evidence Attached",
  "Stakeholders Notified",
  "Verified",
  "Immutable Record"
];

const SolutionSection = () => {
  return (
    <section id="workflow" className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate">Solution</p>
          <h2 className="mt-4 text-3xl font-semibold text-ink">Record events when they happen.</h2>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          {FLOW_STEPS.map((step, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="rounded-2xl border border-cloud bg-mist/60 p-5"
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
                  viewport={{ once: true, amount: 0.7 }}
                  transition={{ duration: 0.6, delay: 0.1 * index }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
