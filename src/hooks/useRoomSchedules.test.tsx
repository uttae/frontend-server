// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

import { roomSchedulesQueryKey } from "@/lib/query-keys";
import { useRoomSchedules } from "./useRooms";

const rooms = vi.hoisted(() => ({ hydrate: vi.fn() }));
vi.mock("@/lib/rooms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  hydrateRoomSchedulesFromServer: rooms.hydrate,
}));

function Probe() {
  useRoomSchedules("room");
  return null;
}

it("reuses schedules on reentry but refetches them when they were invalidated while away", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  rooms.hydrate.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(document.createElement("div"));
  const render = (visible: boolean) =>
    root.render(
      <QueryClientProvider client={client}>{visible && <Probe />}</QueryClientProvider>,
    );
  try {
    await act(async () => render(true));
    await act(async () => render(false));
    await act(async () => render(true));
    expect(rooms.hydrate).toHaveBeenCalledTimes(1);

    await act(async () => render(false));
    await client.invalidateQueries({ queryKey: roomSchedulesQueryKey("room") });
    expect(rooms.hydrate).toHaveBeenCalledTimes(1);

    await act(async () => render(true));
    expect(rooms.hydrate).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});
