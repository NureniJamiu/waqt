import React from "react";
import { HeroSection } from "./HeroSection";
import { ProblemSolution } from "./ProblemSolution";
import { FeaturesGrid } from "./FeaturesGrid";
import { HowItWorks } from "./HowItWorks";
import { HonorSystemManifesto } from "./HonorSystemManifesto";
import { DownloadSection } from "./DownloadSection";
import { FAQSection } from "./FAQSection";
import { Footer } from "./Footer";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <HeroSection />
      <ProblemSolution />
      <FeaturesGrid />
      <HowItWorks />
      <HonorSystemManifesto />
      <DownloadSection />
      <FAQSection />
      <Footer />
    </div>
  );
};

export default LandingPage;
