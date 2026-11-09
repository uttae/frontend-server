// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

import type { RoomListResponse } from "@/lib/api/rooms";
import { ROOMS_QUERY_KEY, roomMembersQueryKey } from "@/lib/query-keys";

import { useLeaveRoom } from "./useRooms";

const api = vi.hoisted(() => ({ leave: vi.fn(), getRooms: vi.fn() }));
vi.mock("@/lib/api/rooms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  leaveRoom: api.leave,
  getRooms: api.getRooms,
}));

const rooms = (ids: string[]): RoomListResponse => ({
  rooms: ids.map((id) => ({ id, title: id, destinations: [], startDate: null, endDate: null, role: "MEMBER", joinedAt: "" })),
  nextCursor: null,
  hasNext: false,
});

it("방을 나가면 그 방 캐시는 다시 받지 않고 지우고, 방 목록만 다시 받도록 표시한다", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.leave.mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(ROOMS_QUERY_KEY, rooms(["left", "other"]));
  client.setQueryData(roomMembersQueryKey("left"), { members: [] });
  client.setQueryData(roomMembersQueryKey("other"), { members: [] });

  let leave: ReturnType<typeof useLeaveRoom>["mutateAsync"] | undefined;
  const capture = (value: typeof leave) => { leave = value; };
  function Probe({ onRender }: { onRender: (value: typeof leave) => void }) {
    onRender(useLeaveRoom().mutateAsync);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Probe onRender={capture} /></QueryClientProvider>));
    await act(async () => { await leave!("left"); });

    // 나간 방의 GET은 403이라 무효화하지 않고 지운다
    expect(client.getQueryState(roomMembersQueryKey("left"))).toBeUndefined();
    expect(client.getQueryState(roomMembersQueryKey("other"))?.isInvalidated).toBe(false);
    expect(client.getQueryData<RoomListResponse>(ROOMS_QUERY_KEY)?.rooms.map((r) => r.id)).toEqual(["other"]);
    expect(client.getQueryState(ROOMS_QUERY_KEY)?.isInvalidated).toBe(true);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});
