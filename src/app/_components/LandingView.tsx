import { CardsSection } from "@/app/_components/CardsSection";
import { CtaSection } from "@/app/_components/CtaSection";
import { FooterSection } from "@/app/_components/FooterSection";
import { HeroSection } from "@/app/_components/HeroSection";
import { KeyPointSection } from "@/app/_components/KeyPointSection";
import { LandingHeader } from "@/app/_components/LandingHeader";
import { LandingMotion } from "@/app/_components/LandingMotion";
import { ProblemSection } from "@/app/_components/ProblemSection";
import { SolutionSection } from "@/app/_components/SolutionSection";
import { StepsSection } from "@/app/_components/StepsSection";

export function LandingView() {
  return (
    <div className="relative flex min-h-screen flex-col bg-white font-sans">
      <LandingHeader />
      <main className="relative z-10 flex flex-1 flex-col antialiased">
        <HeroSection />
        <LandingMotion>
          <ProblemSection />
        </LandingMotion>
        <SolutionSection />
        <LandingMotion>
          <StepsSection />
        </LandingMotion>
        <LandingMotion>
          <KeyPointSection />
        </LandingMotion>
        <LandingMotion>
          <CardsSection />
        </LandingMotion>
        <LandingMotion>
          <CtaSection />
        </LandingMotion>
        <FooterSection />
      </main>
    </div>
  );
}
