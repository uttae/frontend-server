import Link from "next/link";

import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { LandingLogo } from "@/app/_components/LandingArtwork";
import styles from "./landing.module.css";

export function LandingHeader() {
  return <header className={styles.header}>
    <div className={styles.headerInner}>
      <Link href="/" aria-label="우때 홈"><LandingLogo /></Link>
      <div className={styles.headerMenu}>
        <nav aria-label="랜딩 페이지">
          <Link href="/#features">기능</Link>
          <Link href="/#how-it-works">사용방법</Link>
        </nav>
        <LandingActionLink href="/login" analytics={{ cta_id: "login", cta_position: "header" }} className={styles.login}>로그인</LandingActionLink>
      </div>
    </div>
  </header>;
}
