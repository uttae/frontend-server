import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingActionLink } from "@/app/_components/LandingActionLink";

describe("LandingActionLink", () => {
  it("renders an addressable anchor in server HTML", () => {
    const html = renderToStaticMarkup(<LandingActionLink href="/login">무료로 시작하기</LandingActionLink>);

    expect(html).toMatch(/<a\b[^>]*\bhref="\/login"/);
    expect(html).toContain("무료로 시작하기");
  });
});
