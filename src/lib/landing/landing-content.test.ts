import { describe, expect, it } from "vitest";

import {
  LANDING_HOW_STEPS,
  LANDING_TEAM_MEMBERS,
  LANDING_VALUES,
} from "@/lib/landing/landing-content";
import { landingTypography } from "@/lib/landing/landing-typography";

describe("landing content contracts", () => {
  it("keeps the approved product story order", () => {
    expect(LANDING_VALUES.map((item) => item.title)).toEqual([
      "지도 기반 장소 탐색",
      "실시간 팀 협업",
      "여행 맥락을 아는 AI",
    ]);
    expect(LANDING_HOW_STEPS).toHaveLength(3);
  });

  it("publishes the approved co-founder identities", () => {
    expect(LANDING_TEAM_MEMBERS).toEqual([
      {
        name: "김민형",
        englishName: "Minhyung Kim",
        role: "Co-founder",
        description: "서울시립대학교 컴퓨터과학부",
        githubUrl: "https://github.com/minbros",
        githubLabel: "minbros",
        linkedinUrl: "https://www.linkedin.com/in/minbros/",
      },
      {
        name: "박주영",
        englishName: "PARK JU YEONG",
        role: "Co-founder",
        description: "서울시립대학교 컴퓨터과학부",
        githubUrl: "https://github.com/parkjuyeong0312",
        githubLabel: "parkjuyeong0312",
        linkedinUrl:
          "https://www.linkedin.com/in/%EC%A3%BC%EC%98%81-%EB%B0%95-75a83a2a4/",
      },
    ]);
    expect(new Set(LANDING_TEAM_MEMBERS.map((member) => member.role))).toEqual(
      new Set(["Co-founder"]),
    );
  });

  it("does not use the landing display font in text styles", () => {
    const classNames = Object.values(landingTypography).join(" ");
    expect(classNames).not.toContain("font-landing");
    expect(landingTypography.heroBody).toContain("text-base");
    expect(landingTypography.sectionBody).toContain("text-base");
  });
});
