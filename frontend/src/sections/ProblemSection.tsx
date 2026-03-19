import { motion } from "framer-motion";

import { fadeUp } from "../animations/variants";

const ProblemSection = () => {
  return (
    <section id="problem" className="relative overflow-hidden bg-[#f4f8ff]">
      <div className="pointer-events-none absolute -right-20 top-12 h-52 w-52 rounded-full bg-[#93c5fd]/40 blur-3xl" />
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="grid gap-10 rounded-[28px] border border-[#d9e5fb] bg-white/80 p-8 shadow-[0_20px_40px_rgba(20,40,90,0.10)] backdrop-blur lg:grid-cols-2 lg:p-10"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#476294]">The Problem</p>
            <h2 className="font-display mt-4 text-3xl font-bold text-[#0b1730] md:text-4xl">
              Construction carbon reporting cannot be trusted.
            </h2>
          </div>
          <div className="space-y-4 text-base text-[#3f5784]">
            <p>
              Manual documents, late reporting, and disputes leave sustainability claims exposed.
              Evidence arrives after the fact, so compliance teams lose the real story.
            </p>
            <div className="grid gap-3 rounded-2xl border border-[#d9e5fb] bg-[#f8fbff] p-4">
              {["Manual documents", "Late reporting", "Disputes"].map((item) => (
                <div key={item} className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#102446]">{item}</span>
                  <span className="h-2 w-16 rounded-full bg-gradient-to-r from-[#60a5fa] to-[#2563eb]" />
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
