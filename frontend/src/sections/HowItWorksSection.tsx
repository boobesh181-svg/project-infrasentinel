import TimelineComponent from "../components/TimelineComponent";

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="bg-mist/80">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-slate">How it works</p>
        <h2 className="mt-4 text-3xl font-semibold text-ink">Interactive MRV timeline.</h2>
        <TimelineComponent />
      </div>
    </section>
  );
};

export default HowItWorksSection;
