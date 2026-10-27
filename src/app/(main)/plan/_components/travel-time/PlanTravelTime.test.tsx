import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlanTravelTime } from "./PlanTravelTime";

const selectedRoute = vi.hoisted(() => ({
  current: { data: undefined, isPending: false, isError: false, isFetching: false } as Record<string, unknown>,
}));

vi.mock("@/hooks/useRooms", () => ({
  useScheduleItemRoute: () => selectedRoute.current,
  useUpdateScheduleItemTravelMode: () => ({ mutate: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueries: ({ queries }: { queries: unknown[] }) => queries.map(() => ({ data: undefined })),
}));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: false }) }));

function renderSummary() {
  return renderToStaticMarkup(
    createElement(PlanTravelTime, {
      roomId: "room-1",
      scheduleId: 1,
      segmentSourceItemId: 100,
      scheduleFingerprint: "100:a:|101:b:",
      travelMode: "DRIVING",
      contentOnly: true,
    }),
  );
}

describe("PlanTravelTime 요약 줄", () => {
  beforeEach(() => {
    selectedRoute.current = { data: undefined, isPending: false, isError: false, isFetching: false };
  });

  it("다시 받다가 실패해도 마지막 답이 '경로 없음'이면 오류 대신 그 답을 보여 준다", () => {
    selectedRoute.current = { data: null, isPending: false, isError: true, isFetching: false };

    const html = renderSummary();

    expect(html).toContain("이동 안내 없음");
    expect(html).not.toContain("경로 조회 오류");
  });

  it("받은 답 없이 실패하면 오류를 보여 준다", () => {
    selectedRoute.current = { data: undefined, isPending: false, isError: true, isFetching: false };

    expect(renderSummary()).toContain("경로 조회 오류");
  });
});
