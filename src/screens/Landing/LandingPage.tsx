import React, { useState } from "react";
import "./landing.css";
import { HeroSection } from "./HeroSection";
import { HowItWorks } from "./HowItWorks";
import { OfflineDiagram } from "./OfflineDiagram";
import { Customizer } from "./Customizer";
import { HonorSystemManifesto } from "./HonorSystemManifesto";
import { DownloadSection } from "./DownloadSection";
import { FAQSection } from "./FAQSection";
import { Footer } from "./Footer";
import { City, guessCity, useReveal } from "./landingData";

export const LandingPage: React.FC = () => {
  // One city drives the hero cards and the customizer.
  const [city, setCity] = useState<City>(guessCity);
  useReveal();

  return (
    <div className="lp min-h-screen text-slate-100 font-sans">
      <div className="ak-rails" aria-hidden="true" />
      <div className="relative">
        <HeroSection city={city} />
        <main>
          <HowItWorks />
          <OfflineDiagram />
          <Customizer city={city} onCity={setCity} />
          <HonorSystemManifesto />
          <DownloadSection />
          <FAQSection />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;
