import Image from "next/image";

import { landingAssetDir } from "@/lib/public-assets";

/**
 * 랜딩 PROBLEM 섹션 (데스크탑 기준 — 1차: 최소 CSS만)
 *
 * section (아래 화살표 clip-path)
 *  ├─ 헤더  : eyebrow(title/m, primary) + 제목(display/m, text) — gap 24, 가운데정렬
 *  └─ 비주얼: 뒤 windows.png / 앞 img-desktop.png (z-index로 레이어)
 */
export function ProblemSection() {
  return (
    <section className="relative h-[1200px] bg-[var(--blue-100)]">
      {/* z-0: 흰색 배경 판 — ∨자로 잘라 아래 틈으로 파란색이 비침 */}
      <div className="absolute inset-0 z-0 bg-white [clip-path:polygon(0_0,100%_0,100%_85%,50%_100%,0_85%)]" />

      {/* z-10: 콘텐츠(헤더 · 비주얼) — 배경 판 위 */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center pt-30 pb-20">
        <p className="text-title-m text-primary">PROBLEM</p>
        <h2 className="text-display-m text-text">
          여행을 계획할 때마다
          <br />
          여기저기 옮겨 다니고 있지 않나요?
        </h2>
      </div>

      <div className="relative z-10 mx-auto">
        {/* 뒤 (DOM 순서로 img-desktop 아래) */}
        <Image
          src={`${landingAssetDir}/windows.png`}
          alt=""
          aria-hidden
          width={1683}
          height={307}
          className="absolute left-1/2 top-0 w-[1683px] max-w-none -translate-x-1/2 opacity-50"
        />
        {/* 앞 */}
        <Image
          src={`${landingAssetDir}/img-desktop.png`}
          alt="우때 데스크탑 앱 화면"
          width={1480}
          height={950}
          className="relative top-20 mx-auto w-[740px]"
        />
      </div>
    </section>
  );
}
