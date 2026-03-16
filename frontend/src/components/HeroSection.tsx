import { motion } from "framer-motion";

import { fadeInUp } from "../animations/variants";

const HeroSection = () => {
  return (
    <section id="product" className="relative overflow-hidden bg-white">
      <div className="absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-slate/10 blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>
      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate">Enterprise MRV</p>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-ink md:text-5xl">
            Infrastructure for Verified Climate Records
          </h1>
          <p className="mt-6 text-lg text-slate">
            Infrasentinel transforms construction activities into verifiable carbon evidence.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <button className="rounded-md bg-ink px-6 py-3 text-sm font-semibold text-white">
              Request Demo
            </button>
            <a
              href="#workflow"
              className="rounded-md border border-ink px-6 py-3 text-sm font-semibold text-ink"
            >
              Explore Platform
            </a>
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          className="rounded-3xl border border-cloud bg-mist/80 p-8 shadow-panel"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate">Live Workflow</p>
          <h3 className="mt-4 text-xl font-semibold text-ink">Verified evidence in motion</h3>
          <div className="mt-6 space-y-4">
            {["Material Entry", "Evidence Upload", "Multi-party Attestation"].map((item, index) => (
              <div key={item} className="rounded-xl border border-cloud bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate">Stage {index + 1}</p>
                <p className="text-sm font-semibold text-ink">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
