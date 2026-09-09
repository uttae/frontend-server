import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AnalyticsConsentSettingsView,
  getAnalyticsConsentResultMessage,
} from "@/components/analytics/AnalyticsConsentSettings";

describe("getAnalyticsConsentResultMessage", () => {
  it.each([
    [{ persisted: true, state: "granted" }, "분석 쿠키를 허용했습니다."],
    [{ persisted: true, state: "denied" }, "분석 쿠키를 거부했습니다."],
    [
      { persisted: false, state: "granted" },
      "선택은 현재 탭에 적용했지만 브라우저에 저장하지 못했습니다. 새로고침 후 다시 선택해 주세요.",
    ],
    [
      { persisted: false, state: "denied" },
      "선택은 현재 탭에 적용했지만 브라우저에 저장하지 못했습니다. 새로고침 후 다시 선택해 주세요.",
    ],
  ] as const)("maps %o to its settings message", (result, message) => {
    expect(getAnalyticsConsentResultMessage(result)).toBe(message);
  });
});

describe("AnalyticsConsentSettingsView", () => {
  it.each([
    ["pending", "선택 전"],
    ["granted", "분석 쿠키 허용"],
    ["denied", "분석 쿠키 거부"],
  ] as const)("renders %s state accessibly", (consent, label) => {
    const html = renderToStaticMarkup(
      <AnalyticsConsentSettingsView
        consent={consent}
        draft={consent}
        onSave={vi.fn()}
        message=""
        onGrant={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    expect(html).toContain(label);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("허용");
    expect(html).toContain("거부");
  });

  it("announces a persistence failure without hiding the selected state", () => {
    const message =
      "선택은 현재 탭에 적용했지만 브라우저에 저장하지 못했습니다.";
    const html = renderToStaticMarkup(
      <AnalyticsConsentSettingsView
        consent="denied"
        draft="denied"
        onSave={vi.fn()}
        message={message}
        onGrant={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    expect(html).toContain(message);
    expect(html).toContain("분석 쿠키 거부");
  });
});
