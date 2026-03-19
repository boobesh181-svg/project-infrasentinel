import { motion } from "framer-motion";

const STEPS = [
  "Record Activity",
  "Attach Evidence",
  "Independent Attestation",
  "Verification",
  "Immutable Record",
  "MRV Report Generated"
];

const TimelineComponent = () => {
  return (
    <div className="mt-10 space-y-4">
      {STEPS.map((step, index) => (
        <motion.div
          key={step}
          initial={{ opacity: 0, x: -18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, delay: index * 0.08 }}
          className="group rounded-2xl border border-[#d9e5fb] bg-white p-5 shadow-[0_10px_24px_rgba(20,40,90,0.08)] transition hover:-translate-y-0.5 hover:border-[#bfd4ff]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#5471a5]">Step {index + 1}</p>
              <p className="mt-2 text-lg font-semibold text-[#12274e]">{step}</p>
            </div>
            <span className="text-sm text-[#4a5f8b] group-hover:text-[#0f4cc9]">Verified workflow stage</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default TimelineComponent;
