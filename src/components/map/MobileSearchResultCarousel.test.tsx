// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileSearchResultCarousel } from "./MobileSearchResultCarousel";
import { usePlaceSearchStore } from "@/stores/place-search-store";
const state = vi.hoisted(() => ({ detail: vi.fn(), send: vi.fn() }));
vi.mock("@/hooks/useChatActions", () => ({
  useChatActions: () => ({ canSend: true, sendPlaceMessage: state.send }),
}));
vi.mock("@/app/(main)/map/_components/MobileRoutePlaceDetail", () => ({
  MobileRoutePlaceDetail: (props: unknown) => {
    state.detail(props);
    return <div>상세</div>;
  },
}));
vi.mock("@/app/(main)/map/_components/MobileRouteCardCarousel", () => ({
  MobileRouteCardCarousel: ({
    cards,
  }: {
    cards: { key: string; node: React.ReactNode }[];
  }) => (
    <div>
      {cards.map((c) => (
        <div key={c.key}>{c.node}</div>
      ))}
    </div>
  ),
}));
vi.mock("@/components/place/AddToBookmarkModal", () => ({
  AddToBookmarkModal: () => <div>북마크 대화상자</div>,
}));
vi.mock("@/components/place/AddToScheduleModal", () => ({
  AddToScheduleModal: () => <div>일정 대화상자</div>,
}));
let root: Root, host: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.detail.mockReset();
  state.send.mockReset();
  usePlaceSearchStore.setState({
    items: [
      {
        googlePlaceId: "one",
        name: "카페",
        category: "",
        rating: null,
        location: { lat: 1, lng: 2 },
      },
      {
        googlePlaceId: "two",
        name: "공원",
        category: "공원",
        rating: 4.5,
        userRatingCount: 3,
        location: { lat: 3, lng: 4 },
      },
    ],
    selectedId: "one",
    expanded: false,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MobileSearchResultCarousel />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function click(label: string) {
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
      .click(),
  );
}
it("collapsed cards never mount full detail; absent rating/category have no fake values", () => {
  expect(state.detail).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("-");
  expect(host.textContent).toContain("4.5");
});
it("independent bookmark/chat/itinerary buttons do not expand", async () => {
  await click("카페 북마크에 추가");
  expect(host.textContent).toContain("북마크 대화상자");
  expect(usePlaceSearchStore.getState().expanded).toBe(false);
  await click("카페 채팅으로 보내기");
  expect(state.send).toHaveBeenCalledWith(
    expect.objectContaining({ googlePlaceId: "one" }),
  );
  await click("카페 일정에 추가");
  expect(host.textContent).toContain("일정 대화상자");
  expect(state.detail).not.toHaveBeenCalled();
});
it("same card expands and only focused expanded card activates Details", async () => {
  await click("카페 상세 보기");
  expect(usePlaceSearchStore.getState().expanded).toBe(true);
  expect(
    state.detail.mock.calls.filter(([props]) => props.active),
  ).toHaveLength(1);
  expect(host.querySelector('button[aria-label="상세 접기"]')).not.toBeNull();
});
