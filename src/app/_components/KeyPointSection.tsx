import Image from "next/image";

import { landingAssetDir } from "@/lib/public-assets";

/**
 * 랜딩 KEY POINT 섹션 (데스크탑 기준 — 1차: 최소 CSS)
 *
 * section (h 1000 고정, flex-col, bg blue-500)
 *  ├─ 헤더  : eyebrow(title/m, secondary) + 문구(display/m, fill/subtle) — 상단 100px, gap 20px
 *  └─ 이미지: desktop-and-mobile.png (w 1000, 헤더와 60px)
 */
export function KeyPointSection() {
  return (
    <section className="flex h-[1000px] flex-col items-center overflow-hidden bg-[var(--blue-500)]">
      <div className="flex flex-col items-center gap-5 pt-[100px] text-center">
        <p className="text-title-m text-secondary">KEY POINT</p>
        <h2 className="text-display-m text-fill-subtle">
          여행 계획은 PC에서 편리하게
          <br />
          여행 중에는 모바일로 가볍게
        </h2>
      </div>

      <Image
        src={`${landingAssetDir}/desktop-and-mobile.png`}
        alt="우때 PC·모바일 일정 화면"
        width={2016}
        height={1133}
        priority
        sizes="1000px"
        unoptimized={process.env.NODE_ENV === "development"}
        className="mt-[60px] h-auto w-[1000px] max-w-none"
      />
    </section>
  );
}
