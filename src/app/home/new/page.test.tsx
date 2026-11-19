// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { DateRangeField } from "@/components/date-picker/DateRangeField";
import type { DestinationChipsField } from "@/components/rooms/DestinationChipsField";
import NewTripPage from "./page";
import { trackAnalyticsEvent } from "@/lib/analytics/track";

const state = vi.hoisted(() => ({
  destinations: null as ComponentProps<typeof DestinationChipsField> | null,
  dates: null as ComponentProps<typeof DateRangeField> | null,
  create: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  setRoom: vi.fn(),
  setQueryData: vi.fn(),
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
  useSessionStore: (select: (s: unknown) => unknown) =>
    select({ currentRoomId: "old-room", setCurrentRoomId: state.setRoom }),
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { createPlan: "create_plan" },
  trackAnalyticsEvent: vi.fn(),
}));
vi.mock("@/components/rooms/DestinationChipsField", () => ({
  DestinationChipsField: (props: ComponentProps<typeof DestinationChipsField>) => {
    state.destinations = props;
    return null;
  },
}));
vi.mock("@/components/date-picker/DateRangeField", () => ({
  DateRangeField: (props: ComponentProps<typeof DateRangeField>) => {
    state.dates = props;
    return null;
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.clearAllMocks());

const titleInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>("input")!;
const submitButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>("button")!;
async function typeTitle(container: HTMLElement, value: string) {
  const input = titleInput(container);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function changeDates(start: string, end: string) {
  await act(async () => state.dates!.onChange({ start, end }));
}
async function renderPage() {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<NewTripPage />));
  return { container, unmount: () => act(async () => root.unmount()) };
}

it("lets mobile users stay on the form, validates dates, and enters the created trip", async () => {
  const { container, unmount } = await renderPage();
  try {
    expect(state.replace).not.toHaveBeenCalled();
    await typeTitle(container, "  여름 여행  ");
    await act(async () => state.destinations!.onChange(["서울"]));
    await changeDates("2099-07-10", "2099-07-09");
    expect(submitButton(container).disabled).toBe(false);
    await act(async () => submitButton(container).click());
    expect(state.create).not.toHaveBeenCalled();
    expect(container.textContent).toContain("종료일은 시작일 이후여야 해요.");
    await changeDates("2099-07-10", "2099-07-12");
    await act(async () => submitButton(container).click());
    expect(state.create).toHaveBeenCalledWith(
      {
        title: "여름 여행",
        destinations: ["서울"],
        startDate: "2099-07-10",
        endDate: "2099-07-12",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    const room = { id: "new-room", startDate: "2099-07-10", endDate: "2099-07-12" };
    await act(async () => state.create.mock.calls[0][1].onSuccess(room));
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(trackAnalyticsEvent).toHaveBeenCalledWith("create_plan", expect.objectContaining({ room_id: "new-room" }));
    expect(state.setRoom).toHaveBeenCalledWith("new-room");
    expect(state.setQueryData).toHaveBeenCalledWith(expect.any(Array), room);
    expect(state.push).toHaveBeenCalledWith("/plan");
  } finally {
    await unmount();
  }
});

it("shows errors only under the fields the user touched", async () => {
  const { container, unmount } = await renderPage();
  try {
    expect(container.querySelector("[role=alert]")).toBeNull();

    await act(async () => {
      titleInput(container).dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(titleInput(container).getAttribute("aria-invalid")).toBe("true");
    const titleError = container.querySelector(`#${titleInput(container).getAttribute("aria-describedby")}`);
    expect(titleError?.textContent).toBe("여행 제목을 입력해 주세요.");
    expect(container.textContent).not.toContain("여행지를 하나 이상 선택해 주세요.");
    expect(container.textContent).not.toContain("여행 기간을 선택해 주세요.");
    await typeTitle(container, "봄");
    expect(titleInput(container).hasAttribute("aria-invalid")).toBe(false);
    expect(container.textContent).not.toContain("여행 제목을 입력해 주세요.");

    await act(async () => state.destinations!.onChange(["서울"]));
    await act(async () => state.destinations!.onChange([]));
    expect(container.textContent).toContain("여행지를 하나 이상 선택해 주세요.");
    await act(async () => state.destinations!.onChange(["서울"]));
    expect(container.textContent).not.toContain("여행지를 하나 이상 선택해 주세요.");

    await changeDates("2099-07-10", "");
    expect(container.textContent).toContain("여행 기간을 선택해 주세요.");
    await changeDates("2000-01-01", "2000-01-02");
    expect(container.textContent).toContain("시작일은 최초 여행 시작일 이전으로 바꿀 수 없어요.");
    await changeDates("2099-07-10", "2099-07-09");
    expect(container.textContent).toContain("종료일은 시작일 이후여야 해요.");
    await changeDates("2099-07-10", "2099-07-12");
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(state.create).not.toHaveBeenCalled();
  } finally {
    await unmount();
  }
});

it("shows every field error at once when submitting an empty form", async () => {
  const { container, unmount } = await renderPage();
  try {
    expect(submitButton(container).disabled).toBe(false);
    await act(async () => submitButton(container).click());
    expect(state.create).not.toHaveBeenCalled();
    expect(titleInput(container).getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("여행 제목을 입력해 주세요.");
    expect(container.textContent).toContain("여행지를 하나 이상 선택해 주세요.");
    expect(container.textContent).toContain("여행 기간을 선택해 주세요.");
  } finally {
    await unmount();
  }
});

it("shows every field error on the first submit even when the title already has an error from blur", async () => {
  const { container, unmount } = await renderPage();
  try {
    await act(async () => {
      titleInput(container).dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(container.textContent).toContain("여행 제목을 입력해 주세요.");
    expect(container.textContent).not.toContain("여행지를 하나 이상 선택해 주세요.");
    await act(async () => submitButton(container).click());
    expect(state.create).not.toHaveBeenCalled();
    expect(container.textContent).toContain("여행 제목을 입력해 주세요.");
    expect(container.textContent).toContain("여행지를 하나 이상 선택해 주세요.");
    expect(container.textContent).toContain("여행 기간을 선택해 주세요.");
  } finally {
    await unmount();
  }
});
