import Image from "next/image";

import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { landingAssetDir } from "@/lib/public-assets";

/**
 * 랜딩 히어로 섹션
 *
 * - lg(≥1024): 데스크탑 — 좌 카피 / 우 목업(home.png) 블리드, 배경 큰 원(d 1438), 비행기·캐리어
 * - < lg      : 모바일 — 카피 가운데 스택 + mobile-home.png, 배경 원(d 554), h 600
 *
 * 배경 원은 SVG 대신 CSS div (rounded-full)로 처리.
 */
export function HeroSection() {
  return (
    <section className="relative isolate h-[600px] overflow-hidden bg-primary text-white lg:h-[800px]">
      {/* 배경 원 — 데스크탑 (1440 프레임 우측, d 1438) */}
      <div className="relative mx-auto hidden max-w-[1440px] lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-400px] top-[-100px] -z-10 h-[1438px] w-[1438px] rounded-full bg-[var(--blue-600)]"
        />
      </div>

      {/* 배경 원 — 모바일 (d 554, 상단 중앙) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-55 -z-10 h-[554px] w-[554px] -translate-x-1/2 rounded-full bg-[#1eacff]/90 lg:hidden"
      />

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center px-5 pt-12 text-center lg:h-[800px] lg:flex-row lg:items-center lg:px-30 lg:pt-0 lg:text-left">
        {/* 카피 + CTA */}
        <div className="relative z-30 w-full max-w-md break-keep lg:w-[300px] lg:max-w-none lg:shrink-0">
          <h1 className="text-heading-l">
            올인원 해외여행
            <br />
            플래너, <span className="text-secondary">우때</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[320px] text-body-s-regular text-white/90 lg:mx-0 lg:max-w-md lg:pb-10">
            장소부터 일정, 여행 정보까지 해외여행에
            <br />
            필요한 계획을 한곳에서 정리하세요.
          </p>
          <div className="mt-8 flex justify-center lg:justify-start">
            <LandingActionLink
              href="/login"
              className="gap-1.5 bg-white px-6 py-3.5 text-label-xl-emphasis font-bold text-primary shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] hover:bg-white"
            >
              가입 없이 시작하기
              <Image
                src="/icons/right.svg"
                alt=""
                aria-hidden
                width={24}
                height={24}
                unoptimized
                className="size-4"
              />
            </LandingActionLink>
          </div>
        </div>

        {/* 목업 — 데스크탑 (우측 블리드) */}
        <div className="relative hidden flex-1 justify-end lg:bottom-3 lg:flex">
          <Image
            src={`${landingAssetDir}/home.png`}
            alt="우때 여행 일정·지도 화면"
            width={1444}
            height={1130}
            priority
            sizes="750px"
            unoptimized={process.env.NODE_ENV === "development"}
            className="h-auto w-[750px] max-w-none translate-x-[20%] rounded-md shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)]"
          />
        </div>

        {/* 목업 — 모바일 (317×240, h-[600px] 아래로 크롭됨) */}
        <Image
          src={`${landingAssetDir}/mobile/mobile-home.png`}
          alt="우때 여행 일정·지도 화면"
          width={317}
          height={240}
          sizes="317px"
          unoptimized={process.env.NODE_ENV === "development"}
          className="mt-12 h-auto w-[317px] rounded-lg shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] lg:hidden"
        />
      </div>

      {/* 비행기 — lg 이상만 */}
      <Image
        src={`${landingAssetDir}/img-airplane.png`}
        alt=""
        aria-hidden
        width={774}
        height={662}
        unoptimized={process.env.NODE_ENV === "development"}
        className="pointer-events-none absolute left-1/2 top-4 z-10 hidden w-[360px] -translate-x-[80%] lg:block"
      />
      {/* 캐리어 — lg 이상만 */}
      <Image
        src={`${landingAssetDir}/img-suitcases.png`}
        alt=""
        aria-hidden
        width={333}
        height={333}
        unoptimized={process.env.NODE_ENV === "development"}
        className="pointer-events-none absolute bottom-0 left-1/2 z-20 hidden w-[333px] -translate-x-[80%] lg:block"
      />
    </section>
  );
}
