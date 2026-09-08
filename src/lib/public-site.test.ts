import { describe, expect, it } from "vitest";

import { PUBLIC_FOUNDERS, PUBLIC_SITE } from "@/lib/public-site";

describe("public site facts", () => {
  it("publishes only the approved company and product facts", () => {
    expect(PUBLIC_SITE).toMatchObject({
      origin: "https://www.uttae.app",
      serviceName: "우때",
      englishServiceName: "Uttae",
      operatorName: "팀 우때 (Team Uttae)",
      founded: "2026-06",
      location: "Seoul, South Korea",
    });
    expect(PUBLIC_SITE).not.toHaveProperty("githubOrganizationUrl");
  });

  it("publishes both founders with the same co-founder role", () => {
    expect(PUBLIC_FOUNDERS).toEqual([
      {
        name: "김민형",
        englishName: "Minhyung Kim",
        role: "Co-founder",
        githubUrl: "https://github.com/minbros",
        githubLabel: "minbros",
        linkedinUrl: "https://www.linkedin.com/in/minbros/",
      },
      {
        name: "박주영",
        englishName: "PARK JU YEONG",
        role: "Co-founder",
        githubUrl: "https://github.com/parkjuyeong0312",
        githubLabel: "parkjuyeong0312",
        linkedinUrl: "https://www.linkedin.com/in/%EC%A3%BC%EC%98%81-%EB%B0%95-75a83a2a4/",
      },
    ]);
  });

  it("does not publish application-only business or funding claims", () => {
    const publicFacts = JSON.stringify({
      site: PUBLIC_SITE,
      founders: PUBLIC_FOUNDERS,
    });

    expect(publicFacts).not.toMatch(/예약 수수료|투자 유치|VC|funding/i);
  });
});
