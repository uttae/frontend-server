// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { PlanDaySection } from "./PlanDaySection";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("label and switch change route visibility without collapsing the day", async () => {
  usePlanScheduleRouteVisibilityStore.setState({ visibleByScheduleId: {}, visibilityOrder: [] });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<PlanDaySection title="1일차" itineraryScheduleId={10}>장소</PlanDaySection>));
    const heading = host.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    const toggle = host.querySelector<HTMLButtonElement>('[role="switch"]')!;
    await act(async () => host.querySelector("label")!.click());
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(usePlanScheduleRouteVisibilityStore.getState().visibleByScheduleId[10]).toBe(false);
    expect(heading.getAttribute("aria-expanded")).toBe("true");
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(heading.getAttribute("aria-expanded")).toBe("true");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
