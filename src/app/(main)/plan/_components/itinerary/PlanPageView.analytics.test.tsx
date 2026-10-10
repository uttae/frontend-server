// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session-store";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { roomSchedulesQueryKey } from "@/lib/query-keys";
import { PlanPageView } from "./PlanPageView";

const api = vi.hoisted(() => ({ detail: vi.fn() }));
vi.mock("@/lib/client-env", () => ({ clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test" } }));
vi.mock("@/lib/api/rooms", async (original) => ({ ...await original<object>(), getRoomDetail: api.detail }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: true }) }));
vi.mock("../mobile/MobilePlanView", () => ({ MobilePlanView: () => null }));
vi.mock("./PlanScheduleDayBlock", () => ({ PlanScheduleDayBlock: () => null }));
vi.mock("@/lib/analytics/track", () => ({ AnalyticsEvents: { viewPlan: "view_plan" }, trackAnalyticsEvent: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("uses the loaded room detail ID and deduplicates rerenders of that detail", async () => {
  useSessionStore.setState({ currentRoomId: "selected-room" });
  api.detail.mockResolvedValue({ id: "loaded-room", title: "Trip", startDate: "2026-10-10", endDate: "2026-10-10", destinations: [], memberCount: 2, role: "HOST", inviteCode: "private", createdAt: "2026-10-10" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(roomSchedulesQueryKey("selected-room"), []);
  const root = createRoot(document.createElement("div"));
  const render = () => root.render(<QueryClientProvider client={client}><PlanPageView /></QueryClientProvider>);
  try {
    await act(async () => { render(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(api.detail).toHaveBeenCalledWith("selected-room");
    expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("view_plan", expect.objectContaining({ room_id: "loaded-room" }));
    await act(async () => { render(); });
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
});
