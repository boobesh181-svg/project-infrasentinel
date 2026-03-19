import TimelineComponent from "../components/TimelineComponent";

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
        <p className="text-xs uppercase tracking-[0.24em] text-[#476294]">How it works</p>
        <h2 className="font-display mt-4 text-3xl font-bold text-[#0b1730] md:text-4xl">Interactive MRV timeline.</h2>
        <TimelineComponent />
      </div>
    </section>
  );
};

export default HowItWorksSection;
