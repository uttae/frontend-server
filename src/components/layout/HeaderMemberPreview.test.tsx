// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { RoomMember } from "@/lib/api/rooms";

const state = vi.hoisted(() => ({ headerInviteHidden: false }));

const member = (userId: number, nickname: string, role: RoomMember["role"]): RoomMember => ({
  userId,
  nickname,
  profileImageUrl: null,
  role,
  status: "ACTIVE",
  joinedAt: "2026-11-01T00:00:00",
  isOnline: true,
});
const members = [member(1, "나", "HOST"), member(2, "친구", "MEMBER")];

vi.mock("@/app/(main)/member-settings/_components/useMemberActions", () => ({
  useMemberActions: () => ({
    user: { id: 1 },
    roomId: "room",
    members,
    me: members[0],
    others: [members[1]],
    isHost: false,
    roomDetail: undefined,
    isDetailLoading: false,
    isDetailError: false,
    memberCount: 2,
    leaveDisabled: false,
    openLeaveDialog: vi.fn(),
    requestKick: vi.fn(),
    requestTransfer: vi.fn(),
    dialogs: null,
  }),
}));
vi.mock("@/hooks/useHostJoinRequestsBadgeCount", () => ({ useHostJoinRequestsBadgeCount: () => 0 }));
vi.mock("@/app/(main)/member-settings/_components/JoinRequestsSection", () => ({ JoinRequestsSection: () => null }));
vi.mock("@/app/(main)/member-settings/_components/MemberList", () => ({ MemberList: () => <ul /> }));
vi.mock("@/components/user/UserAvatar", () => ({ UserAvatar: () => <span /> }));
vi.mock("@/components/rooms/InviteRoomDialog", () => ({ InviteRoomDialog: () => <div role="dialog">초대 창</div> }));

import { HeaderMemberPreview } from "./HeaderMemberPreview";

let host: HTMLDivElement;
let root: Root;
const trigger = () => host.querySelector<HTMLButtonElement>('button[aria-label="구성원 2명"]')!;
const panelButtons = () =>
  [...document.querySelectorAll('[aria-label="구성원 관리"] button')].map((button) => button.textContent?.trim());

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = original(element, pseudo);
    if (!(host.contains(element) && element.textContent?.trim() === "초대하기")) return style;
    return new Proxy(style, {
      get: (target, key) => {
        if (key === "display") return state.headerInviteHidden ? "none" : "inline-flex";
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<HeaderMemberPreview />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it("moves 초대하기 above 방 나가기 in the member panel when the header is narrow", async () => {
  state.headerInviteHidden = true;
  await act(async () => trigger().click());
  expect(panelButtons()).toEqual(["초대하기", "방 나가기"]);

  const panelInvite = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="구성원 관리"] button')].find(
    (button) => button.textContent?.trim() === "초대하기",
  )!;
  await act(async () => panelInvite.click());
  expect(document.body.textContent).toContain("초대 창");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});

it("keeps 초대하기 only in the header when the header is wide", async () => {
  state.headerInviteHidden = false;
  await act(async () => trigger().click());
  expect(panelButtons()).toEqual(["방 나가기"]);
});
