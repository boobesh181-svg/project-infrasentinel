import { motion } from "framer-motion";

import AboutStorySection from "../components/AboutStorySection";

const AboutPage = () => {
  return (
    <div className="bg-white">
      <section className="bg-mist/80">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate">About</p>
            <h1 className="mt-4 text-4xl font-bold text-ink md:text-5xl">
              Building the trust layer for infrastructure carbon data.
            </h1>
            <p className="mt-6 text-lg text-slate">
              Infrasentinel was founded to close the gap between construction activity and verified
              climate records.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <AboutStorySection />
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
