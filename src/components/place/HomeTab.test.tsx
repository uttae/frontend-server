import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeTab } from "./HomeTab";

describe("HomeTab", () => {
  it("주소 아래에 새 탭으로 여는 Google Maps 링크를 표시한다", () => {
    const googleMapsUrl = "https://www.google.com/maps/search/?api=1&query=%EC%84%B1%EC%88%98&query_place_id=ChIJ-test";
    const html = renderToStaticMarkup(
      createElement(HomeTab as ComponentType<Record<string, unknown>>, {
        address: "서울 성동구 성수동",
        googleMapsUrl,
      }),
    );

    expect(html).toContain("서울 성동구 성수동");
    expect(html).toContain(`href="${googleMapsUrl.replaceAll("&", "&amp;")}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Google Maps에서 보기");
    expect(html.indexOf("서울 성동구 성수동")).toBeLessThan(html.indexOf("Google Maps에서 보기"));
  });
});
