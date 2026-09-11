import type { CSSProperties } from "react";

import { LandingArtwork } from "@/app/_components/LandingArtwork";
import styles from "./landing.module.css";

const windows = [
  { width: 262, left: -16.79, scale: 642.75 },
  { width: 271, left: -380.13, scale: 621.4 },
  { width: 259, left: -125.22, scale: 650.19 },
  { width: 413, left: -145.61, scale: 407.75 },
  { width: 324, left: -405.72, scale: 519.75 },
] as const;

function ProblemAndSolution() {
  return <>
    <section data-landing-section="problem" className={styles.problem}>
      <div className={styles.problemInner}>
        <LandingArtwork name="problem-background.svg" width={1440} height={1198.2} className={styles.problemBackground} />
        <LandingArtwork name="mobile-problem-background.svg" width={394} height={399.28} className={styles.mobileProblemBackground} />
        <div className={styles.problemTitle}>
          <p className={styles.eyebrow}>PROBLEM</p>
          <h2>여행을 계획할 때마다<br />여기저기 옮겨 다니고 있지 않나요?</h2>
        </div>
        <div className={styles.windows} aria-hidden="true">
          {windows.map((window) => <div key={window.width}
            style={{ "--window-width": window.width } as CSSProperties}>
            <LandingArtwork name="windows.png" width={1774} height={887}
              style={{ left: `${window.left}%`, width: `${window.scale}%` }} />
          </div>)}
        </div>
        <div className={styles.problemDesktop}>
          <LandingArtwork name="desktop.png" width={1672} height={941}
            alt="여러 창을 오가며 여행 계획을 정리하는 모습" />
        </div>
      </div>
    </section>
    <section data-landing-section="solution" className={styles.solution}>
      <div className={styles.solutionInner}>
        <div className={styles.solutionTitle}>
          {/* The approved desktop spells this SOULTION; mobile spells SOLUTION. */}
          <p className={`${styles.eyebrow} ${styles.desktopOnly}`}>SOULTION</p>
          <p className={`${styles.eyebrow} ${styles.mobileOnly}`}>SOLUTION</p>
          <h2>복잡한 여행 계획은 <span>우때 하나로 끝!</span></h2>
        </div>
        <LandingArtwork name="laptop-shadow.svg" mobileName="mobile-laptop-shadow.svg" width={1188} height={142} className={styles.laptopShadow} />
        <LandingArtwork name="laptop.png" width={992} height={604} className={styles.laptop}
          alt="여행 일정과 지도를 함께 보여주는 우때 노트북 화면" />
      </div>
    </section>
  </>;
}

const features = [
  {
    title: ["장소를 검색하고", "북마크에 저장해요"],
    description: ["마음에 드는 여행지를 검색하고 저장해", "바로 여행 일정에 활용해 보세요."],
    tags: ["가고 싶은 곳 저장하기", "검색한 장소 북마크", "일정에 추가하기"],
    icons: ["CarbonLocationStarFilled", "BoxiconsBookmarkFilled", "AntDesignCalendarFilled"],
    image: "search.png", width: 731, height: 564,
    alt: "검색한 여행 장소를 북마크에 저장하는 화면",
  },
  {
    title: ["저장한 장소로", "일정을 완성해요"],
    description: ["저장해둔 장소를 날짜별로 배치하고", "지도에서 여행 동선을 한눈에 확인하세요."],
    tags: ["날짜별 일정 정리", "지도에서 동선 확인", "실시간 공동 편집"],
    icons: ["CiListChecklist", "HeroiconsMap16Solid", "BxsMessageSquareEdit"],
    image: "schedule.png", width: 774, height: 580,
    alt: "저장한 장소로 날짜별 일정과 지도 동선을 완성한 화면",
  },
  {
    title: ["친구와 함께 계획하고", "AI에게 도움받아요"],
    description: ["여행 멤버를 초대해 일정을 함께 만들고,", "고민되는 순간에는 AI에게 장소와 일정을 물어보세요."],
    tags: ["채팅으로 빠른 소통", "장소·일정 바로 공유", "AI 채팅 기능"],
    icons: ["BxsChat", "BoxiconsPeopleDiversity", "BoxiconsSparkleCircleFilled"],
    image: "chat.png", width: 627, height: 699,
    alt: "친구와 장소를 공유하고 AI에게 여행 추천을 받는 채팅 화면",
  },
] as const;

function Features() {
  return <section id="features" data-landing-section="features" className={styles.features} aria-label="우때 기능">
    <div className={styles.featuresInner}>
      {features.map((feature, index) => <article className={styles.feature} key={feature.image}>
        <div className={styles.featureCopy}>
          <p className={`${styles.eyebrow} ${styles.step}`}>STEP {index + 1}</p>
          <h2>{feature.title[0]}<br />{feature.title[1]}</h2>
          <p className={styles.featureDescription}>
            {feature.description[0]}<br />
            {index === 2 ? <>고민되는 순간에는 AI에게 장소와<span className={styles.desktopBreak}><br /></span><span className={styles.mobileOnly}> </span>일정을 물어보세요.</> : feature.description[1]}
          </p>
          <ul className={styles.tags}>
            {feature.tags.map((tag, tagIndex) => <li key={tag}>
              <LandingArtwork name={`${feature.icons[tagIndex]}.svg`} width={16} height={16} />
              {tag}
            </li>)}
          </ul>
        </div>
        <LandingArtwork name={feature.image} width={feature.width} height={feature.height}
          alt={feature.alt} className={styles.featureImage} />
      </article>)}
      <div className={styles.track} aria-hidden="true">
        <LandingArtwork name="track-upper.svg" width={838} height={894} className={styles.trackUpper} />
        <LandingArtwork name="track-lower.svg" width={826} height={940} className={styles.trackLower} />
        <LandingArtwork name="track-dot.svg" width={38} height={38} className={styles.trackDotOne} />
        <LandingArtwork name="track-dot.svg" width={38} height={38} className={styles.trackDotTwo} />
        <LandingArtwork name="pin-shadow.svg" width={40} height={40} className={styles.pinShadow} />
        <div className={styles.pin}><LandingArtwork name="pin.png" width={76} height={76} /></div>
      </div>
    </div>
  </section>;
}

function Devices() {
  return <section data-landing-section="devices" className={styles.devices}>
    <div className={styles.devicesInner}>
      <div className={styles.devicesTitle}>
        <p className={styles.eyebrow}>KEY POINT</p>
        <h2>여행 계획은 PC에서 편리하게<br />여행 중에는 모바일로 가볍게</h2>
      </div>
      <div className={styles.deviceImages}>
        <LandingArtwork name="web.png" width={750} height={566.5} className={styles.deviceWeb}
          alt="PC에서 여행 일정을 계획하는 우때 화면" />
        <LandingArtwork name="phone.png" width={222} height={464.5} className={styles.devicePhone}
          alt="여행 중 모바일에서 일정을 확인하는 우때 화면" />
      </div>
    </div>
  </section>;
}

const steps = [
  // Image widths include the leaf/image percentages, mobile .85 scale and 1440px container cap.
  { title: "여행 시작하기", description: "새로운 여행을 만들어요", image: "passport",
    sizes: "(min-width: 1440px) 241.36px, (min-width: 720px) 16.76132vw, (max-width: 392px) 104.55px, 122.99px" },
  { title: "장소 둘러보기", description: "가고 싶은 장소를 모아요", image: "map",
    sizes: "(min-width: 1440px) 260px, (min-width: 720px) 18.05556vw, (max-width: 392px) 122.93px, 144.62px" },
  { title: "일정 완성하기", description: "장소를 일정으로 연결해요", image: "calendar",
    sizes: "(min-width: 1440px) 229.44px, (min-width: 720px) 15.93362vw, (max-width: 392px) 105.52px, 124.14px" },
  { title: "일정 확인하기", description: "여행 중 일정을 확인해요", image: "globe",
    sizes: "(min-width: 1440px) 262.53px, (min-width: 720px) 18.23097vw, (max-width: 392px) 122.2px, 143.77px" },
] as const;

function TravelSteps() {
  return <section id="how-it-works" data-landing-section="travel_steps" className={styles.how}>
    <div className={styles.howInner}>
      <h2><span>여행 계획은</span><br />이렇게 완성하세요!</h2>
      <ol className={styles.cards}>
        {steps.map((step, index) => <li className={styles.card} key={step.image}>
          <div className={styles.cardCopy}>
            <span className={styles.cardNumber}>0{index + 1}</span>
            <h3>{step.title}</h3><p>{step.description}</p>
          </div>
          <div className={`${styles.cardArt} ${styles[step.image]}`}>
            <div className={styles.cardArtLeaf}>
              <LandingArtwork name={`${step.image}.png`} width={1536} height={1536} sizes={step.sizes} />
            </div>
          </div>
        </li>)}
      </ol>
    </div>
  </section>;
}

export function LandingDesignSections() {
  return <>
    <ProblemAndSolution />
    <Features />
    <Devices />
    <TravelSteps />
  </>;
}
