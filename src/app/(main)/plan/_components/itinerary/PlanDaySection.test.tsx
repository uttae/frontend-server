import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanDaySection } from "./PlanDaySection";

describe("PlanDaySection", () => {
  it("일차 제목 뒤에 날짜, 그 뒤에 펼침 토글 아이콘을 둔다", () => {
    const html = renderToStaticMarkup(
      createElement(
        PlanDaySection,
        {
          title: "1일차",
          subtitle: "07. 16 목",
        },
        createElement("div", null, "일정"),
      ),
    );

    const triggerMarkup = html.match(/<button[^>]*aria-expanded="true"[^>]*>([\s\S]*?)<\/button>/)?.[1];

    expect(triggerMarkup).toBeDefined();
    expect(triggerMarkup!.indexOf("1일차")).toBeLessThan(triggerMarkup!.indexOf("07. 16 목"));
    expect(triggerMarkup!.lastIndexOf("<svg")).toBeGreaterThan(triggerMarkup!.indexOf("07. 16 목"));
  });

  it("shows the cost summary and route switch below the day heading, before places", () => {
    const html = renderToStaticMarkup(
      createElement(
        PlanDaySection,
        {
          title: "1일차",
          itineraryScheduleId: 10,
          summaryAction: createElement("button", null, "비용 3건 · 128,000 KRW"),
        },
        createElement("div", null, "장소 카드"),
      ),
    );

    expect(html).toContain("비용 3건 · 128,000 KRW");
    expect(html.indexOf("비용 3건 · 128,000 KRW")).toBeLessThan(html.indexOf("장소 카드"));
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(html).toContain("경로 보기");
  });
});
