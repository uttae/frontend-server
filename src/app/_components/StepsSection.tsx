import Image from "next/image";

import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { LANDING_CONTAINER_CLASS } from "@/lib/landing/landing-content";
import { landingAssetDir } from "@/lib/public-assets";

/**
 * 랜딩 STEPS 섹션 (데스크탑 기준 — 1차: 최소 CSS)
 *
 * section (relative, flex-col)
 *  ├─ 배경 경로 track.svg (absolute, z-0) — 점선 + 원 노드
 *  └─ steps (relative, z-10)
 *      ├─ Step1  [목업] [텍스트]
 *      ├─ Step2  [텍스트] [목업]  (flex-row-reverse)
 *      └─ Step3  [목업] [텍스트]
 *
 * 텍스트: 헤더 display/m·text, 서브 body/regular·text-subtle, 둘 사이 16px
 * 버튼: 기존 LandingActionLink (스타일은 추후 조정)
 */
export function StepsSection() {
  return (
    <section className="relative flex flex-col overflow-hidden py-30 h-[3066px]">
      {/* z-0: 배경 경로 (점선 + 원 노드) */}
      <Image
        src={`${landingAssetDir}/track.svg`}
        alt=""
        aria-hidden
        width={890}
        height={2165}
        unoptimized
        className="pointer-events-none absolute left-[calc(50%-640px)] top-[160px] top-0 z-0"
      />

      {/* z-10: steps */}
      <div className={`${LANDING_CONTAINER_CLASS} relative z-10 flex flex-col gap-[200px]`}>
        {/* Step 1 — 목업 | 텍스트 */}
        <div className="flex items-start justify-center gap-[180px]">
          <Image
            src={`${landingAssetDir}/img-search.png`}
            alt="우때 장소 검색 화면"
            width={1462}
            height={1128}
            unoptimized={process.env.NODE_ENV === "development"}
            className="h-auto w-[731px] max-w-none pt-20"
          />
          <div className="flex flex-col pt-20">
            <h2 className="text-display-m text-text">
              장소를 검색하고
              <br />
              북마크에 저장해요
            </h2>
            <p className="mt-4 text-body-m-regular text-text-subtle">
              마음에 드는 여행지를 검색하고 저장해
              <br />
              바로 여행 일정에 활용해 보세요.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 pt-10 pr-6 [&>a]:w-full [&>a]:justify-center [&>a]:rounded-lg [&>a]:border-primary [&>a]:bg-fill-subtle [&>a]:px-6 [&>a]:py-4 [&>a]:text-title-l [&>a]:text-primary">
              <LandingActionLink href="/login">가고 싶은 곳 저장하기</LandingActionLink>
              <LandingActionLink href="/login">검색한 장소 북마크</LandingActionLink>
              <LandingActionLink href="/login">일정에 추가하기</LandingActionLink>
            </div>
          </div>
        </div>

        {/* Step 2 — 텍스트 | 목업 */}
        <div className="flex flex-row-reverse items-start justify-center gap-20 pt-60">
          <Image
            src={`${landingAssetDir}/home_3.png`}
            alt="우때 일정·지도 화면"
            width={1548}
            height={1160}
            unoptimized={process.env.NODE_ENV === "development"}
            className="h-auto w-[774px] max-w-none"
          />
          <div className="flex flex-col items-start pt-20">
            <h2 className="text-display-m text-text">
              저장한 장소로
              <br />
              일정을 완성해요
            </h2>
            <p className="mt-4 text-body-m-regular text-text-subtle">
              저장해둔 장소를 날짜별로 배치하고
              <br />
              지도에서 여행 동선을 한눈에 확인하세요.
            </p>
            <div className="mt-8 flex flex-col items-start w-full pr-3 gap-3 pt-10 [&>a]:w-full [&>a]:justify-center [&>a]:rounded-lg [&>a]:border-primary [&>a]:bg-fill-subtle [&>a]:px-6 [&>a]:py-4 [&>a]:text-title-l [&>a]:text-primary">
              <LandingActionLink href="/login">날짜별 일정 정리</LandingActionLink>
              <LandingActionLink href="/login">지도에서 동선 확인</LandingActionLink>
              <LandingActionLink href="/login">실시간 공동 편집</LandingActionLink>
            </div>
          </div>
        </div>

        {/* Step 3 — 목업 | 텍스트 */}
        <div className="flex items-start justify-center gap-[160px] pt-60 pl-20">
          <Image
            src={`${landingAssetDir}/img-chat.png`}
            alt="우때 채팅·AI 화면"
            width={1254}
            height={1398}
            unoptimized={process.env.NODE_ENV === "development"}
            className="h-auto w-[627px] max-w-none"
          />
          <div className="flex flex-col pt-10">
            <h2 className="text-display-m text-text">
              친구와 함께 계획하고
              <br />
              AI에게 도움받아요
            </h2>
            <p className="mt-4 text-body-m-regular text-text-subtle">
              여행 멤버를 초대해 일정을 함께 만들고,
              <br />
              고민되는 순간에는 AI에게 장소와
              <br />
              일정을 물어보세요.
            </p>
            <div className="mt-8 flex flex-col items-start w-full pr-10 gap-3 pt-10 [&>a]:w-full [&>a]:justify-center [&>a]:rounded-lg [&>a]:border-primary [&>a]:bg-fill-subtle [&>a]:px-6 [&>a]:py-4 [&>a]:text-title-l [&>a]:text-primary">
              <LandingActionLink href="/login">채팅으로 빠른 소통</LandingActionLink>
              <LandingActionLink href="/login">장소·일정 바로 공유</LandingActionLink>
              <LandingActionLink href="/login">AI 채팅 기능</LandingActionLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
