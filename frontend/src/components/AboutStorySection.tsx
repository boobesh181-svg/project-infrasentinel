import { motion } from "framer-motion";

const SECTIONS = [
  {
    title: "Mission",
    description:
      "Deliver infrastructure that turns construction activity into verified climate records."
  },
  {
    title: "The Problem",
    description:
      "Carbon reporting depends on reconciling disjointed documents after projects end."
  },
  {
    title: "The Idea",
    description:
      "Capture evidence at the moment of activity and verify it with independent parties."
  },
  {
    title: "Why It Matters",
    description:
      "Infrastructure decisions demand defensible data trusted by regulators and investors."
  },
  {
    title: "Vision",
    description:
      "A world where every climate disclosure is backed by immutable records."
  }
];

const TIMELINE = [
  "Concept: verify every delivery in real time",
  "Prototype: immutable evidence trail for major projects",
  "System: multi-party attestations and deterministic MRV reports",
  "Future: automated trust layer for infrastructure reporting"
];

const AboutStorySection = () => {
  return (
    <div className="space-y-16">
      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((section, index) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="rounded-2xl border border-cloud bg-mist/60 p-6"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate">{section.title}</p>
            <p className="mt-3 text-lg font-semibold text-ink">{section.description}</p>
          </motion.div>
        ))}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Founder Story</p>
        <h2 className="mt-4 text-3xl font-semibold text-ink">
          Designing a system that never loses its evidence.
        </h2>
        <div className="mt-8 space-y-4">
          {TIMELINE.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="rounded-2xl border border-cloud bg-white p-5"
            >
              <p className="text-sm font-semibold text-ink">{item}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutStorySection;
