import Image from "next/image";

import { landingAssetDir } from "@/lib/public-assets";

/**
 * 랜딩 SOLUTION 섹션 (데스크탑 기준 — 1차: 최소 CSS)
 *
 * section (flex-col, h 1094 고정, bg primary-subtle)
 *  ├─ 헤더  : eyebrow(title/m, primary) + 제목(display/m, "우때 하나로 끝!" 하이라이트)
 *  └─ 에셋  : relative — 타원 그림자 2개(z-0) 뒤 / 노트북 목업(z-10) 앞
 */
export function SolutionSection() {
  return (
    <section className="flex h-[1094px] flex-col items-center overflow-hidden bg-primary-subtle">
      <div className="flex flex-col items-center gap-6 pt-30 pb-20 text-center">
        <p className="text-title-m text-primary">SOLUTION</p>
        <h2 className="text-display-m text-text">
          복잡한 여행 계획은{" "}
          <mark className=" bg-primary px-3 py-1 text-white">우때 하나로 끝!</mark>
        </h2>
      </div>

      <div className="relative mt-auto w-full">
        {/* z-0: 타원 그림자 (노트북 뒤) — 또렷한 타원 (blur 없음) */}
        <div className="absolute bottom-[90px] left-1/2 z-0 h-[142px] w-[1180px] -translate-x-1/2 rounded-[50%] bg-[var(--blue-200)]/70" />
        <div className="absolute bottom-[130px] left-1/2 z-0 h-[81px] w-[997px] -translate-x-1/2 rounded-[50%] bg-[var(--blue-300)]/70" />

        {/* z-10: 노트북 목업 */}
        <Image
          src={`${landingAssetDir}/laptop_2.png`}
          alt="우때 일정·지도 화면 (노트북)"
          width={1984}
          height={1208}
          priority
          sizes="1000px"
          className="relative z-10 mx-auto w-[1000px] max-w-none"
        />
      </div>
    </section>
  );
}
