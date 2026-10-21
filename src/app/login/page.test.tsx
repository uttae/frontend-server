import type { ImgHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- 테스트에서는 전달 속성을 그대로 확인한다.
    return <img {...props} />;
  },
}));

vi.mock("@/lib/google-oauth", () => ({
  buildGoogleAuthorizationUrl: vi.fn(),
  clearGoogleAgreementFlowSession: vi.fn(),
  messageForOAuthLoginErrorParam: vi.fn(),
  saveOAuthPendingSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    // Exercise the page's real Suspense fallback while navigation data is pending.
    throw new Promise<never>(() => {});
  },
}));

import LoginPage from "@/app/login/page";

describe("LoginFallback", () => {
  it("renders meaningful non-interactive login HTML", () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain("로그인하고 여행 계획을 이어가세요");
    expect(html).toContain("Google로 계속하기");
    expect(html).toContain('href="/"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-disabled="true"');
  });
});
