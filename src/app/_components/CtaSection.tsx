import Image from "next/image";

import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * 랜딩 CTA 섹션 (데스크탑 기준 — 1차: 최소 CSS)
 *
 * section (h 600 고정, bg fill/subtle, 중앙 정렬)
 *  ├─ 타원형 그라데이션 (CSS radial-gradient, primary-subtle, 화면 꽉차게)
 *  └─ 콘텐츠(z-10): 앱로고 → 문구(display/m, primary-strong + text) → 서브(text-subtle) → CTA 버튼(채움)
 */
export function CtaSection() {
  return (
    <section className="relative flex h-[600px] w-full flex-col items-center justify-center overflow-hidden bg-fill-subtle">
      {/* 타원형 그라데이션 — primary-subtle 중앙 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_55%_at_50%_50%,var(--color-primary-subtle)_0%,var(--color-primary-subtle)_15%,transparent_60%)]"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        <BrandLogo variant="glyph" size="M" alt="우때" />

        <h2 className="mt-5 text-display-m">
          <span className="text-primary-strong">우때</span>
          <span className="text-text">, 우리 함께할 때</span>
        </h2>
        <p className="mt-2 text-body-l-regular text-text-subtle">
          혼자여도, 함께여도, 여행 준비가 더 편해지는 순간
        </p>

        <LandingActionLink
          href="/login"
          className="mt-14 gap-1.5 rounded-lg bg-primary px-6 py-3.5 text-[17px] text-text-inverse hover:bg-primary"
        >
          가입 없이 시작하기
          {/* icons/right.svg — 흰색으로 반전 */}
          <Image
            src="/icons/right.svg"
            alt=""
            aria-hidden
            width={24}
            height={24}
            unoptimized
            className="brightness-0 invert"
          />
        </LandingActionLink>
      </div>
    </section>
  );
}
