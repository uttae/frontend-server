// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RoomDetail, RoomListItem } from "@/lib/api/rooms";
import { RoomCardMenu } from "./RoomCardMenu";

const state = vi.hoisted(() => ({
  detail: null as RoomDetail | null,
  loading: false, error: false, pending: false,
  regenerate: vi.fn(), refetch: vi.fn(), copy: vi.fn(), toastError: vi.fn(),
  detailId: vi.fn(),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRegenerateInviteCode: () => ({ mutate: state.regenerate, isPending: state.pending }),
}));
vi.mock("@/hooks/useRoomDetail", () => ({
  useRoomDetail: (id: string) => {
    state.detailId(id);
    return { data: state.detail, isLoading: state.loading, isError: state.error, refetch: state.refetch };
  },
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { sharePlan: "share_plan" }, trackAnalyticsEvent: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: state.toastError, info: vi.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const room: RoomListItem = { id: "selected-room", title: "제주 여행", destinations: ["제주"], startDate: null, endDate: null, role: "HOST", joinedAt: "2026-09-20" };
let host: HTMLDivElement;
let root: Root;
const onDelete = vi.fn();
const onLeave = vi.fn();
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === label || b.getAttribute("aria-label") === label)!;
const click = async (label: string) => {
  expect(button(label), `button: ${label}`).toBeDefined();
  await act(async () => button(label).click());
};
const render = async (role: "HOST" | "MEMBER" = "HOST") => {
  await act(async () => root.render(<RoomCardMenu room={{ ...room, role }} onDelete={onDelete} onLeave={onLeave} />));
};
const openInvite = async () => {
  await render();
  await click("제주 여행 더보기");
  await click("초대하기");
};
beforeEach(() => {
  vi.clearAllMocks();
  state.detail = { ...room, inviteCode: "existing-code", memberCount: 2, createdAt: "2026-09-20" };
  state.loading = false;
  state.error = false;
  state.pending = false;
  state.copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: state.copy } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("opens the selected room's invite link without regenerating it and restores focus on Escape", async () => {
  await openInvite();
  expect(document.querySelector("dialog[open]")?.textContent).toContain("제주 여행");
  expect(state.detailId).toHaveBeenCalledWith("selected-room");
  expect(state.regenerate).not.toHaveBeenCalled();
  await click("복사");
  expect(state.copy).toHaveBeenCalledWith(`${window.location.origin}/join/existing-code`);
  expect(button("복사됨 ✓")).toBeDefined();
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector("dialog[open]")).toBeNull();
  expect(document.activeElement).toBe(button("제주 여행 더보기"));
  expect(onDelete).not.toHaveBeenCalled();
});

it("issues a link once when the room detail confirms no existing code", async () => {
  state.detail!.inviteCode = null;
  await openInvite();
  expect(state.regenerate).toHaveBeenCalledTimes(1);
  expect(state.regenerate.mock.calls[0][0]).toBe("selected-room");
  await act(async () => state.regenerate.mock.calls[0][1].onSuccess({ inviteCode: "first-code" }));
  await click("복사");
  expect(state.copy).toHaveBeenCalledWith(`${window.location.origin}/join/first-code`);
});

it.each(["loading", "error", "member"])("does not issue links while detail is %s", async (mode) => {
  state.detail!.inviteCode = null;
  state.loading = mode === "loading";
  state.error = mode === "error";
  if (mode === "member") state.detail!.role = "MEMBER";
  await openInvite();
  expect(state.regenerate).not.toHaveBeenCalled();
  expect(button("복사")).toBeUndefined();
  if (mode === "error") {
    await click("다시 시도");
    expect(state.refetch).toHaveBeenCalledOnce();
  }
});

it("reports clipboard failure without claiming the link was copied", async () => {
  state.copy.mockRejectedValue(new Error("clipboard denied"));
  await openInvite();
  await click("복사");
  expect(state.toastError).toHaveBeenCalled();
  expect(button("복사됨 ✓")).toBeUndefined();
});

it("regenerates only on request and keeps the existing link when regeneration fails", async () => {
  await openInvite();
  await click("초대 링크 재발급");
  expect(state.regenerate).toHaveBeenCalledTimes(1);
  await act(async () => state.regenerate.mock.calls[0][1].onError());
  await click("복사");
  expect(state.copy).toHaveBeenLastCalledWith(`${window.location.origin}/join/existing-code`);
  await click("초대 링크 재발급");
  await act(async () => state.regenerate.mock.calls[1][1].onSuccess({ inviteCode: "new-code" }));
  await click("복사");
  expect(state.copy).toHaveBeenLastCalledWith(`${window.location.origin}/join/new-code`);
});

it("blocks copying and sharing the old link while regeneration is pending", async () => {
  await openInvite();
  await click("초대 링크 재발급");
  state.pending = true;
  await render();
  expect(button("복사").disabled).toBe(true);
  expect(button("친구에게 공유").disabled).toBe(true);
  expect(document.querySelector<HTMLInputElement>('input[aria-label="초대 링크"]')?.disabled).toBe(true);
  state.pending = false;
  await act(async () => state.regenerate.mock.calls[0][1].onSuccess({ inviteCode: "new-code" }));
  await render();
  await click("복사");
  expect(state.copy).toHaveBeenLastCalledWith(`${window.location.origin}/join/new-code`);
});

it("preserves host deletion and member leave permissions", async () => {
  await render();
  await click("제주 여행 더보기");
  await click("방 삭제하기");
  expect(onDelete).toHaveBeenCalledWith(room);
  await render("MEMBER");
  await click("제주 여행 더보기");
  expect(button("초대하기")).toBeUndefined();
  expect(button("방 삭제하기")).toBeUndefined();
  await click("방 나가기");
  expect(onLeave).toHaveBeenCalledWith({ ...room, role: "MEMBER" });
});
