import ArchitectureSection from "../sections/ArchitectureSection";
import DemoSection from "../sections/DemoSection";
import HeroSection from "../components/HeroSection";
import HowItWorksSection from "../sections/HowItWorksSection";
import ImpactSection from "../sections/ImpactSection";
import ProblemSection from "../sections/ProblemSection";
import SolutionSection from "../sections/SolutionSection";
import UseCasesSection from "../sections/UseCasesSection";

const HomePage = () => {
  return (
    <div>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <ArchitectureSection />
      <UseCasesSection />
      <ImpactSection />
      <DemoSection />
    </div>
  );
};

export default HomePage;
