import Link from "next/link";

import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { LandingScreenshot } from "@/app/_components/LandingScreenshot";
import { LANDING_CONTAINER_CLASS } from "@/lib/landing/landing-content";
import {
  LANDING_HERO_SCREENSHOT,
  LANDING_HERO_SCREENSHOT_SIZES,
} from "@/lib/landing/landing-screenshots";
import { landingTypography } from "@/lib/landing/landing-typography";

export function LandingHero() {
  return (
    <section className="bg-[radial-gradient(circle_at_50%_12%,rgba(1,131,255,0.11),transparent_35%)] pt-20 pb-10 landing-lg:pt-28 landing-lg:pb-14">
      <div className={`${LANDING_CONTAINER_CLASS} text-center`}>
        <p className={landingTypography.eyebrow}>REAL-TIME TRAVEL PLANNER</p>
        <h1 className={`${landingTypography.heroTitle} mx-auto mt-4 max-w-4xl`}>
          흩어진 여행 계획을
          <br />
          한곳에서, 함께.
        </h1>
        <p className={`${landingTypography.heroBody} mx-auto mt-5 max-w-2xl`}>
          장소를 찾고, 대화하고, 일정을 짜는 모든 과정을 친구들과 실시간으로 완성하세요.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <LandingActionLink href="/login" className="px-7 py-3">
            무료로 시작하기
          </LandingActionLink>
          <Link
            href="/#features"
            className="inline-flex items-center justify-center rounded-full border border-gray-border bg-white px-7 py-3 text-base font-bold text-dark-gray transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            기능 살펴보기
          </Link>
        </div>
        <div className="mx-auto mt-12 max-w-[1080px] overflow-hidden rounded-2xl border border-gray-border bg-white p-2 shadow-[0_24px_70px_-28px_rgba(71,31,33,0.28)] landing-sm:p-3">
          <p className="px-3 pb-3 pt-2 text-left text-sm font-semibold text-dark-gray">
            우때 실제 서비스 화면
          </p>
          <LandingScreenshot
            screenshot={LANDING_HERO_SCREENSHOT}
            priority
            sizes={LANDING_HERO_SCREENSHOT_SIZES}
            className="rounded-xl"
          />
        </div>
      </div>
    </section>
  );
}
