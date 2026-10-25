import { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  expire: vi.fn(),
  fetchUser: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@/lib/auth-session-client", () => ({
  expireClientSessionAndRedirect: mocks.expire,
}));
vi.mock("@/lib/session-user", () => ({
  fetchSessionUserRaw: mocks.fetchUser,
}));
vi.mock("@/lib/session-user-cache", () => ({
  setSessionUserCache: mocks.setUser,
}));

import { refreshSessionBeforeReconnect } from "@/lib/stomp/stomp-session-recovery";

const fetchMock = vi.fn<typeof fetch>();

function setup(isActive = true) {
  const client = { deactivate: vi.fn(() => Promise.resolve()) };
  const queryClient = new QueryClient();
  const run = () =>
    refreshSessionBeforeReconnect({
      client: client as unknown as Client,
      queryClient,
      isActive: () => isActive,
    });
  return { client, queryClient, run };
}

beforeEach(() => {
  // probeClientSession은 브라우저에서만 세션을 확인한다
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.clearAllMocks();
});

describe("refreshSessionBeforeReconnect", () => {
  it("stops reconnecting and expires the client session when the session is gone", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const { client, queryClient, run } = setup();

    await run();

    expect(client.deactivate).toHaveBeenCalledOnce();
    expect(mocks.expire).toHaveBeenCalledWith({ queryClient });
  });

  it("syncs the session user before reconnecting with a valid session", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const user = { id: 1 };
    mocks.fetchUser.mockResolvedValueOnce(user);
    const { client, queryClient, run } = setup();

    await run();

    expect(mocks.setUser).toHaveBeenCalledWith(queryClient, user);
    expect(client.deactivate).not.toHaveBeenCalled();
  });

  it.each([503, 500])(
    "lets stompjs attempt the connection when the session check returns %i",
    async (status) => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status }));
      const { client, run } = setup();

      await run();

      expect(client.deactivate).not.toHaveBeenCalled();
      expect(mocks.expire).not.toHaveBeenCalled();
    },
  );

  it("treats a network failure as transient", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { client, run } = setup();

    await expect(run()).resolves.toBeUndefined();

    expect(client.deactivate).not.toHaveBeenCalled();
    expect(mocks.expire).not.toHaveBeenCalled();
  });

  it("does nothing when the connection was torn down while checking", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const { client, run } = setup(false);

    await run();

    expect(client.deactivate).not.toHaveBeenCalled();
    expect(mocks.expire).not.toHaveBeenCalled();
  });
});
