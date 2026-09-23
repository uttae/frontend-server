// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useCurrentRoomId, useResolvedCurrentRoomId } from "./use-room-id";
import { bootstrapCurrentRoomFromSessionStorage, useSessionStore } from "@/stores/session-store";
import { SESSION_CURRENT_ROOM_ID_KEY } from "@/lib/session-room-storage";
const path = vi.hoisted(() => ({ current: "/search" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const id = "12345678-1234-1234-1234-123456789abc";
beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem(SESSION_CURRENT_ROOM_ID_KEY, "stored-old");
  useSessionStore.setState({ currentRoomId: "old" });
});
it("generic and explicit consumers see packing URL from their first render", async () => {
  path.current = `/packing/${id}`;
  const seen: (string | null)[] = [];
  const hook = hookHarness(() => {
    const current = useCurrentRoomId();
    const generic = useResolvedCurrentRoomId();
    seen.push(current.roomId, generic.effectiveRoomId);
    return current;
  });
  await hook.render(undefined);
  expect(seen.every(room => room === id)).toBe(true);
  expect(useSessionStore.getState().currentRoomId).toBe(id);
  expect(sessionStorage.getItem(SESSION_CURRENT_ROOM_ID_KEY)).toBe(id);
  await hook.unmount();
});
it("malformed packing URL suppresses room and every bootstrap write", async () => {
  path.current = "/packing/bad";
  const hook = hookHarness(() => useCurrentRoomId());
  await hook.render(undefined);
  bootstrapCurrentRoomFromSessionStorage(path.current);
  expect(hook.current.roomId).toBeNull();
  expect(useSessionStore.getState().currentRoomId).toBe("old");
  expect(sessionStorage.getItem(SESSION_CURRENT_ROOM_ID_KEY)).toBe("stored-old");
  await hook.unmount();
});
