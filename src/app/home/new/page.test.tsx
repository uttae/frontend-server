// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { TripFormFields } from "@/components/rooms/TripFormFields";
import NewTripPage from "./page";

const state = vi.hoisted(() => ({
  fields: null as ComponentProps<typeof TripFormFields> | null,
  create: vi.fn(), push: vi.fn(), replace: vi.fn(),
  setRoom: vi.fn(), setQueryData: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push, replace: state.replace }),
  usePathname: () => "/home/new",
}));
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: true }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: state.setQueryData }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useCreateRoom: () => ({ mutate: state.create, isPending: false, error: null }),
}));
vi.mock("@/stores/session-store", () => ({
  useSessionStore: (select: (s: unknown) => unknown) => select({ setCurrentRoomId: state.setRoom }),
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { createPlan: "create_plan" }, trackAnalyticsEvent: vi.fn(),
}));
vi.mock("@/components/rooms/TripFormFields", () => ({
  TripFormFields: (props: ComponentProps<typeof TripFormFields>) => {
    state.fields = props;
    return null;
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.clearAllMocks());

it("lets mobile users stay on the form, validates dates, and enters the created trip", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<NewTripPage />));
    expect(state.replace).not.toHaveBeenCalled();
    const submit = container.querySelector("button")!;
    expect(submit.disabled).toBe(true);
    await act(async () => {
      state.fields!.onTitleChange("  여름 여행  ");
      state.fields!.onDestinationsChange(["서울"]);
      state.fields!.onStartDateChange("2099-07-10");
      state.fields!.onEndDateChange("2099-07-09");
    });
    expect(submit.disabled).toBe(true);
    await act(async () => state.fields!.onEndDateChange("2099-07-12"));
    expect(submit.disabled).toBe(false);
    await act(async () => submit.click());
    expect(state.create).toHaveBeenCalledWith({
      title: "여름 여행", destinations: ["서울"],
      startDate: "2099-07-10", endDate: "2099-07-12",
    }, expect.objectContaining({ onSuccess: expect.any(Function) }));
    const room = { id: "new-room", startDate: "2099-07-10", endDate: "2099-07-12" };
    await act(async () => state.create.mock.calls[0][1].onSuccess(room));
    expect(state.setRoom).toHaveBeenCalledWith("new-room");
    expect(state.setQueryData).toHaveBeenCalledWith(expect.any(Array), room);
    expect(state.push).toHaveBeenCalledWith("/plan");
  } finally {
    await act(async () => root.unmount());
  }
});
