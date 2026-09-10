import { LandingDesignSections } from "@/app/_components/LandingDesignSections";
import { LandingFinalCta } from "@/app/_components/LandingFinalCta";
import { LandingHeader } from "@/app/_components/LandingHeader";
import { LandingHero } from "@/app/_components/LandingHero";
import { LandingLogo } from "@/app/_components/LandingArtwork";
import { SiteFooter } from "@/components/layout/SiteFooter";
import styles from "./landing.module.css";

export function LandingView() {
  return <div className={`${styles.landing} font-sans antialiased`}>
    <LandingHeader />
    <main>
      <LandingHero />
      <LandingDesignSections />
      <LandingFinalCta />
    </main>
    <SiteFooter className={styles.footer} logo={<LandingLogo />} />
  </div>;
}
