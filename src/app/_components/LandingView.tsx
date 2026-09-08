import { LandingCollaborationSection } from "@/app/_components/LandingCollaborationSection";
import { LandingCompanySection } from "@/app/_components/LandingCompanySection";
import { LandingFeatureStory } from "@/app/_components/LandingFeatureStory";
import { LandingFinalCta } from "@/app/_components/LandingFinalCta";
import { HeroSection } from "@/app/_components/HeroSection";
import { LandingHeader } from "@/app/_components/LandingHeader";
import { LandingHowItWorks } from "@/app/_components/LandingHowItWorks";
import { LandingMotion } from "@/app/_components/LandingMotion";
import { LandingTeamSection } from "@/app/_components/LandingTeamSection";
import { LandingValueStrip } from "@/app/_components/LandingValueStrip";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LANDING_FEATURE_STORIES } from "@/lib/landing/landing-content";
import { ProblemSection } from "./ProblemSection";

export function LandingView() {
  return (
    <div className="relative flex min-h-screen flex-col bg-white font-sans">
      <LandingHeader />
      <main className="relative z-10 flex flex-1 flex-col antialiased">
        <HeroSection />
        <ProblemSection />
        <LandingValueStrip />
        <div id="features" className="scroll-mt-24">
          {LANDING_FEATURE_STORIES.map((story, index) => (
            <LandingMotion key={story.id}>
              <LandingFeatureStory
                story={story}
                tone={index % 2 === 0 ? "white" : "tint"}
              />
            </LandingMotion>
          ))}
        </div>
        <LandingMotion>
          <LandingCollaborationSection />
        </LandingMotion>
        <LandingMotion>
          <LandingHowItWorks />
        </LandingMotion>
        <LandingMotion>
          <LandingCompanySection />
        </LandingMotion>
        <LandingMotion>
          <LandingTeamSection />
        </LandingMotion>
        <LandingMotion>
          <LandingFinalCta />
        </LandingMotion>
      </main>
      <SiteFooter className="font-sans" />
    </div>
  );
}
