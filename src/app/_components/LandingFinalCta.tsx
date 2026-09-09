import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { LandingArtwork } from "@/app/_components/LandingArtwork";
import styles from "./landing.module.css";

export function LandingFinalCta() {
  return <section className={styles.finalCta}>
    <div className={styles.finalInner}>
      <LandingArtwork name="cta-background.svg" mobileName="mobile-cta-background.svg" width={1440} height={600} className={styles.ctaBackground} />
      <div className={styles.finalCopy}>
        <LandingArtwork name="cta-symbol.svg" mobileName="mobile-cta-symbol.svg" width={40} height={40} className={styles.ctaSymbol} />
        <h2><span>우때, </span>우리 함께할 때</h2>
        <p className={styles.desktopOnly}>혼자여도, 함께여도, 여행 준비가 더 편해지는 순간</p>
        <p className={styles.mobileOnly}>혼자여도, 함께여도<br />여행 준비가 더 편해지는 순간</p>
        <LandingActionLink href="/login" className={`${styles.action} ${styles.finalAction}`}>
          여행 시작하기
          <LandingArtwork name="chevron-white.svg" mobileName="mobile-chevron-white.svg" width={28} height={28} />
        </LandingActionLink>
      </div>
    </div>
  </section>;
}
