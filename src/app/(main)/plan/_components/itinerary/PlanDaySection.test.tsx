import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanDaySection } from "./PlanDaySection";

describe("PlanDaySection", () => {
  it("펼침 토글 아이콘을 제목 왼쪽에 배치한다", () => {
    const html = renderToStaticMarkup(
      createElement(
        PlanDaySection,
        {
          title: "1일차",
          subtitle: "7월 16일 (목)",
        },
        createElement("div", null, "일정"),
      ),
    );

    const triggerMarkup = html.match(
      /<button[^>]*aria-expanded="true"[^>]*>([\s\S]*?)<\/button>/,
    )?.[1];

    expect(triggerMarkup).toBeDefined();
    expect(triggerMarkup).toContain('class="shrink-0 text-dark-gray"');
    expect(triggerMarkup).not.toContain("ml-auto");
    expect(triggerMarkup!.indexOf("lucide-chevron-up")).toBeLessThan(
      triggerMarkup!.indexOf("7월 16일 (목)"),
    );
    expect(html).not.toContain("absolute left-1/2");
  });

  it("keeps the cost summary and route switch visible in the day footer", () => {
    const html = renderToStaticMarkup(createElement(
      PlanDaySection,
      {
        title: "1일차",
        itineraryScheduleId: 10,
        footerAction: createElement("button", null, "비용 3건 · 128,000 KRW"),
      },
      createElement("div", null, "일정"),
    ));

    expect(html).toContain("비용 3건 · 128,000 KRW");
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(html).toContain("지도에 경로 표시");
  });
});
