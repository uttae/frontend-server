// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import HomePage from "./page";

const state = vi.hoisted(() => ({ isMobileDevice: true }));

vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: state.isMobileDevice }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomsList: () => ({ data: { rooms: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/app/home/_components/RoomCard", () => ({ RoomCard: () => null }));
vi.mock("@/app/home/_components/DeleteConfirmModal", () => ({ DeleteConfirmModal: () => null }));
vi.mock("@/app/home/_components/LeaveConfirmModal", () => ({ LeaveConfirmModal: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("places the only create-trip link inside the mobile empty state", async () => {
  await act(async () => root.render(<HomePage />));

  const links = host.querySelectorAll<HTMLAnchorElement>('a[href="/home/new"]');
  expect(links).toHaveLength(1);
  expect(host.querySelector("main")?.contains(links[0])).toBe(true);
  expect(host.textContent).toContain("아직 생성된 여행방이 없어요");
});
