import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { LandingArtwork } from "@/app/_components/LandingArtwork";
import styles from "./landing.module.css";

export function LandingHero() {
  return <section data-landing-section="hero" className={styles.hero}>
    <div className={styles.heroInner}>
      <LandingArtwork name="hero-background.svg" width={1438} height={1438} className={styles.heroBackground} />
      <LandingArtwork name="mobile-hero-background.svg" width={554} height={554} className={styles.mobileHeroBackground} />
      <div className={styles.airplane}>
        <LandingArtwork name="airplane.png" width={387} height={387} />
      </div>
      <LandingArtwork name="hero-web-current.png" width={750} height={567} className={styles.heroWeb}
        alt="지도와 날짜별 여행 일정을 한곳에서 확인하는 우때 화면" priority />
      <div className={styles.heroCopy}>
        <h1>올인원 해외여행<br />플래너, <span>우때</span></h1>
        <p>장소부터 일정, 여행 정보까지 해외여행에<br />필요한 계획을 한곳에서 정리하세요.</p>
        <LandingActionLink href="/login" analytics={{ cta_id: "start_trip", cta_position: "hero" }} className={`${styles.action} ${styles.heroAction}`}>
          여행 시작하기
          <LandingArtwork name="chevron-blue.svg" mobileName="mobile-chevron-blue.svg" width={24} height={24} />
        </LandingActionLink>
      </div>
      <div className={styles.suitcases}>
        <LandingArtwork name="suitcases.png" width={333} height={333} />
      </div>
    </div>
  </section>;
}
