import Image from "next/image";
import { ChevronRight } from "lucide-react";

import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { landingAssetDir } from "@/lib/public-assets";
import { LANDING_CONTAINER_CLASS } from "@/lib/landing/landing-content";

/**
 * 랜딩 히어로 섹션 (데스크탑 기준 — 모바일 대응은 추후)
 *
 * section(relative, bg-primary, overflow-hidden)
 *  ├─ 배경 웨이브(Ellipse) — 우측을 감싸는 큰 원
 *  ├─ 비행기 / 캐리어 — section 기준 절대 배치, 콘텐츠 위로 겹침(z-20)
 *  └─ 콘텐츠(z-10) — 좌: 카피 + CTA / 우: 앱 목업(home.png)
 *
 * 에셋: public/landing/ (Ellipse 5.svg 는 단일 원이라 인라인 SVG로 대체)
 */
export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-primary text-white ">
      {/* 배경 웨이브 — public/landing/Ellipse 5.svg (#0099FF, blue-600) */}
      {/* <svg
        aria-hidden
        viewBox="0 0 1037 800"
        preserveAspectRatio="xMaxYMid slice"
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-[70%] min-w-[720px]"
      >
        <circle cx="800" cy="752" r="800" fill="var(--blue-600)" />
      </svg> */}
      {/* 1440 가운데 정렬 컨테이너 — 원의 기준점 */}
      <div className="relative mx-auto max-w-[1440px]">
        <div
          aria-hidden
          className="pointer-events-none absolute -z-10 rounded-full bg-[var(--blue-600)] h-[1438px] w-[1438px] right-[-400px] top-[-100px]"
        />
      </div>
      <div
        id="hero-content"
        className={`${LANDING_CONTAINER_CLASS} relative z-20 flex h-[800px] items-center`}
      >
        {/* 좌측 — 카피 + CTA */}
        <div className="w-[25%] shrink-0">
          <h1 className="text-display-l leading-[1.15]">
            올인원 해외여행
            <br />
            플래너, <span className="text-secondary">우때</span>
          </h1>
          <p className="mt-5 pb-10 max-w-md text-title-m font-medium text-white/90">
            장소부터 일정, 여행 정보까지 해외여행에 필요한 계획을 한곳에서 정리하세요.
          </p>
          <div className="mt-8">
            <LandingActionLink
              href="/login"
              className="gap-1.5 bg-white px-6 py-3.5 text-[17px] text-primary shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] hover:bg-white"
            >
              가입 없이 시작하기
              <ChevronRight className="size-4" aria-hidden />
            </LandingActionLink>
          </div>
        </div>

        {/* 우측 — 앱 목업 (우측으로 블리드) */}
        <div className="relative flex-1 bottom-3 flex justify-end ">
          <Image
            src={`${landingAssetDir}/home.png`}
            alt="우때 여행 일정·지도 화면"
            width={1444}
            height={1130}
            priority
            sizes="720px"
            unoptimized={process.env.NODE_ENV === "development"}
            className="h-auto w-[750px] max-w-none translate-x-[20%] rounded-md shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)]"
          />
        </div>
      </div>

      {/* 비행기 — 콘텐츠 위로 겹침 */}
      <Image
        src={`${landingAssetDir}/img-airplane.png`}
        alt=""
        aria-hidden
        width={774}
        height={662}
        unoptimized={process.env.NODE_ENV === "development"}
        className="pointer-events-none absolute left-1/2 top-4 z-10 w-[34%] max-w-[360px] -translate-x-[80%]"
      />
      {/* 캐리어 — 좌측 하단 */}
      <Image
        src={`${landingAssetDir}/img-suitcases.png`}
        alt=""
        aria-hidden
        width={333}
        height={333}
        unoptimized={process.env.NODE_ENV === "development"}
        className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-[80%]"
      />
    </section>
  );
}
