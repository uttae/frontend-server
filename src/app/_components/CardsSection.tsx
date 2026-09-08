import Image from "next/image";

import { landingAssetDir } from "@/lib/public-assets";

/**
 * 랜딩 CARDS 섹션 (데스크탑 기준 — 1차: 카드 4개 딱 붙여 내용만, 곡선 배치 X)
 *
 * section (bg primary-subtle, flex-col)
 *  ├─ 헤더  : "여행 계획은"(primary) + "이렇게 완성하세요!"(text)
 *  └─ 카드 4개 (320×347, gap 0) — 파랑(blue-500) / 흰색(gray-50) 교차
 *      카드: 제목 heading/s + 설명 body/l-emphasis (gap 4px) + 아이콘
 *      파랑 카드 글자 text-inverse / 흰색 카드 제목 text-default·설명 text-subtle
 */
export function CardsSection() {
  return (
    <section id="how-it-works" className="flex flex-col items-center bg-primary-subtle py-30 h-[860px]">
      <h2 className="text-display-m w-full text-start px-40">
        <span className="text-primary">여행 계획은</span>
        <br />
        <span className="text-text">이렇게 완성하세요!</span>
      </h2>

      <div className="mt-30 flex justify-center">
        {/* Card 1 — 파랑 */}
        <div className="relative flex h-[347px] w-[320px] translate-y-5 -rotate-[2deg] flex-col overflow-hidden rounded-xl bg-[var(--blue-500)] p-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-heading-s text-text-inverse">여행 시작하기</h3>
            <p className="text-body-l-emphasis text-text-inverse">새로운 여행을 만들어요</p>
          </div>
          <Image
            src={`${landingAssetDir}/img-passport.svg`}
            alt=""
            aria-hidden
            width={225}
            height={230}
            unoptimized
            className="absolute bottom-0 right-0 h-[230px] w-[225px]"
          />
        </div>

        {/* Card 2 — 흰색 */}
        <div className="relative z-10 -ml-6 flex h-[347px] w-[320px] -translate-y-11 rotate-[4deg] flex-col overflow-hidden rounded-xl bg-[var(--gray-50)] p-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-heading-s text-text">장소 둘러보기</h3>
            <p className="text-body-l-emphasis text-text-subtle">가고 싶은 장소를 모아요</p>
          </div>
          <Image
            src={`${landingAssetDir}/img-map.svg`}
            alt=""
            aria-hidden
            width={260}
            height={260}
            unoptimized
            className="absolute bottom-0 right-0 h-[260px] w-[260px]"
          />
        </div>

        {/* Card 3 — 파랑 */}
        <div className="relative z-20 -ml-6 flex h-[347px] w-[320px] translate-y-8 -rotate-[2deg] flex-col overflow-hidden rounded-xl bg-[var(--blue-500)] p-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-heading-s text-text-inverse">일정 완성하기</h3>
            <p className="text-body-l-emphasis text-text-inverse">장소를 일정으로 연결해요</p>
          </div>
          <Image
            src={`${landingAssetDir}/img-calendar.svg`}
            alt=""
            aria-hidden
            width={230}
            height={230}
            unoptimized
            className="absolute bottom-0 right-0 h-[230px] w-[230px]"
          />
        </div>

        {/* Card 4 — 흰색 */}
        <div className="relative -ml-6 flex h-[347px] w-[320px] -translate-y-6 rotate-[4deg] flex-col overflow-hidden rounded-xl bg-[var(--gray-50)] p-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-heading-s text-text">일정 확인하기</h3>
            <p className="text-body-l-emphasis text-text-subtle">여행 중 일정을 확인해요</p>
          </div>
          <Image
            src={`${landingAssetDir}/img-globe.svg`}
            alt=""
            aria-hidden
            width={260}
            height={260}
            unoptimized
            className="absolute bottom-0 right-0 h-[260px] w-[260px]"
          />
        </div>
      </div>
    </section>
  );
}
