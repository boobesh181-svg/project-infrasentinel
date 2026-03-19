import { motion } from "framer-motion";

const USE_CASES = [
  {
    title: "Construction Developers",
    detail: "Track embodied carbon across portfolios with clear evidence trails."
  },
  {
    title: "Infrastructure Investors",
    detail: "Access verified MRV data for financing and risk mitigation."
  },
  {
    title: "Government Regulators",
    detail: "Standardize compliance and audits for public infrastructure."
  },
  {
    title: "ESG Reporting Teams",
    detail: "Produce investor-ready disclosures without manual reconciliation."
  }
];

const UseCaseCards = () => {
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      {USE_CASES.map((item, index) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          className="group rounded-2xl border border-[#d9e5fb] bg-[#f8fbff] p-6 shadow-[0_10px_24px_rgba(20,40,90,0.08)] transition hover:-translate-y-1 hover:border-[#bfd4ff]"
        >
          <p className="text-lg font-semibold text-[#12274e]">{item.title}</p>
          <p className="mt-3 text-sm text-[#4b628f] group-hover:text-[#0f4cc9]">{item.detail}</p>
        </motion.div>
      ))}
    </div>
  );
};

export default UseCaseCards;
