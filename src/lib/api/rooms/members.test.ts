import { beforeEach, expect, it, vi } from "vitest";

const fetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch: fetcher }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));

import { getRoomMembers } from "./members";

beforeEach(() => fetcher.mockReset());

it("멤버 목록 조회에 취소 signal을 넘겨, 무효화로 취소된 옛 조회의 HTTP 요청도 끊는다", async () => {
  const controller = new AbortController();
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ members: [] })));

  await getRoomMembers("room", controller.signal);

  expect(fetcher.mock.lastCall?.[0]).toBe("http://fixture/rooms/room/members");
  expect(fetcher.mock.lastCall?.[1]).toEqual({ signal: controller.signal });
});

it("signal 없이 부르면 지금처럼 init 없이 보낸다", async () => {
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ members: [] })));

  await getRoomMembers("room");

  expect(fetcher.mock.lastCall?.[1]).toBeUndefined();
});
