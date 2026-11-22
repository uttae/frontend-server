import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingCompanySection } from "@/app/_components/LandingCompanySection";
import { LandingHowItWorks } from "@/app/_components/LandingHowItWorks";
import { LandingTeamSection } from "@/app/_components/LandingTeamSection";

describe("landing static sections", () => {
  it("renders all onboarding steps at once", () => {
    const html = renderToStaticMarkup(<LandingHowItWorks />);
    expect(html).toContain("로그인하고 여행 방 만들기");
    expect(html).toContain("친구를 초대해 함께 장소 고르기");
    expect(html).toContain("일정과 이동 동선 완성하기");
    expect(html).not.toContain('role="tablist"');
  });

  it("renders the approved operational facts", () => {
    const html = renderToStaticMarkup(<LandingCompanySection />);

    expect(html).toContain("2026년 6월");
    expect(html).toContain("대한민국 서울");
    expect(html).toContain("팀 우때 (Team Uttae)");
    expect(html).not.toMatch(/예약 수수료|투자 유치/);
  });

  it("renders both co-founders with GitHub and LinkedIn links", () => {
    const html = renderToStaticMarkup(<LandingTeamSection />);
    expect(html).toContain("김민형");
    expect(html).toContain("Minhyung Kim");
    expect(html).toContain("박주영");
    expect(html).toContain("PARK JU YEONG");
    expect(html.match(/>Co-founder</g)).toHaveLength(2);
    expect(html).not.toContain("공동창업자 · Co-founder");
    expect(html.match(/서울시립대학교 컴퓨터과학부/g)).toHaveLength(2);
    expect(html).not.toContain("우때를 공동으로 만들고 운영합니다.");
    expect(html).toContain('href="https://github.com/minbros"');
    expect(html).toContain('href="https://github.com/parkjuyeong0312"');
    expect(html).toContain('href="https://www.linkedin.com/in/minbros/"');
    expect(html).toContain('href="https://www.linkedin.com/in/%EC%A3%BC%EC%98%81-%EB%B0%95-75a83a2a4/"');
    expect(html).not.toContain('href="https://github.com/uttae"');
    expect(html.match(/>GitHub</g)).toHaveLength(2);
    expect(html).not.toContain("GitHub ·");
    expect(html.match(/>LinkedIn</g)).toHaveLength(2);
    expect(html.match(/target="_blank"/g)).toHaveLength(4);
    expect(html.match(/rel="noreferrer"/g)).toHaveLength(4);
  });
});
