import { motion } from "framer-motion";

import { fadeUp } from "../animations/variants";

const ProblemSection = () => {
  return (
    <section id="problem" className="bg-mist/80">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="grid gap-10 lg:grid-cols-2"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate">The Problem</p>
            <h2 className="mt-4 text-3xl font-semibold text-ink">
              Construction carbon reporting cannot be trusted.
            </h2>
          </div>
          <div className="space-y-4 text-base text-slate">
            <p>
              Manual documents, late reporting, and disputes leave sustainability claims exposed.
              Evidence arrives after the fact, so compliance teams lose the real story.
            </p>
            <div className="grid gap-3 rounded-2xl border border-cloud bg-white p-4">
              {["Manual documents", "Late reporting", "Disputes"].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{item}</span>
                  <span className="h-2 w-12 rounded-full bg-cloud" />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ProblemSection;
