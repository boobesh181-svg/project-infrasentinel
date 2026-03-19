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
    <section id="workflow" className="bg-[#f9fbff]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-[0.24em] text-[#476294]">Solution</p>
          <h2 className="font-display mt-4 text-3xl font-bold text-[#0b1730] md:text-4xl">Record events when they happen.</h2>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          {FLOW_STEPS.map((step, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="rounded-2xl border border-[#d9e5fb] bg-white p-5 shadow-[0_10px_24px_rgba(20,40,90,0.08)]"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-[#5471a5]">{index + 1}</p>
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#1da1f2] to-[#2563eb]" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#12274e]">{step}</p>
              <div className="mt-4 h-1 w-full rounded-full bg-[#dde8fb]">
                <motion.div
                  className="h-1 rounded-full bg-gradient-to-r from-[#2563eb] to-[#0ea5e9]"
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
