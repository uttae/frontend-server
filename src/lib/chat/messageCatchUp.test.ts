import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/lib/api/errors";

import {
  CHAT_CATCH_UP_PAGE_SIZE,
  fetchRoomMessagesAfter,
  retryChatHistoryRequest,
} from "./messageCatchUp";

const mocks = vi.hoisted(() => ({ getRoomMessages: vi.fn() }));

vi.mock("@/lib/api/rooms", () => ({ getRoomMessages: mocks.getRoomMessages }));

function rows(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    id: `m${from + i}`,
    roomId: "room",
    senderId: 2,
    messageType: "CHAT",
    content: "",
    createdAt: new Date(Date.UTC(2026, 9, 25, 0, 0, from + i)).toISOString(),
    sequence: from + i,
  }));
}

const active = () => true;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("fetchRoomMessagesAfter", () => {
  it("pages past the cursor until a short page", async () => {
    mocks.getRoomMessages
      .mockResolvedValueOnce(rows(41, 240))
      .mockResolvedValueOnce(rows(241, 440))
      .mockResolvedValueOnce(rows(441, 450));

    const result = await fetchRoomMessagesAfter("room", 40, active);

    expect(result).toHaveLength(410);
    expect(mocks.getRoomMessages.mock.calls).toEqual([
      ["room", { afterSequence: "40", size: CHAT_CATCH_UP_PAGE_SIZE }],
      ["room", { afterSequence: "240", size: CHAT_CATCH_UP_PAGE_SIZE }],
      ["room", { afterSequence: "440", size: CHAT_CATCH_UP_PAGE_SIZE }],
    ]);
  });

  it("asks once when nothing was missed", async () => {
    mocks.getRoomMessages.mockResolvedValueOnce([]);

    await expect(fetchRoomMessagesAfter("room", 40, active)).resolves.toEqual([]);
    expect(mocks.getRoomMessages).toHaveBeenCalledTimes(1);
  });

  it.each([0, undefined])(
    "loads the latest page instead of afterSequence=%s",
    async (cursor) => {
      mocks.getRoomMessages.mockResolvedValueOnce(rows(1, 3));

      const result = await fetchRoomMessagesAfter("room", cursor, active);

      expect(result.map((m) => m.sequence)).toEqual([1, 2, 3]);
      expect(mocks.getRoomMessages).toHaveBeenCalledWith("room", { size: 15 });
    },
  );
});

describe("retryChatHistoryRequest", () => {
  it.each([new TypeError("Failed to fetch"), new HttpError(503, "unavailable")])(
    "retries %s after the backoff delay",
    async (error) => {
      vi.useFakeTimers();
      const request = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("ok");

      const pending = retryChatHistoryRequest(request, active);
      await vi.advanceTimersByTimeAsync(999);
      expect(request).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toBe("ok");
      expect(request).toHaveBeenCalledTimes(2);
    },
  );

  it.each([400, 403, 404])("does not retry %s", async (status) => {
    const request = vi.fn().mockRejectedValue(new HttpError(status, "rejected"));

    await expect(retryChatHistoryRequest(request, active)).rejects.toBeInstanceOf(HttpError);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("gives up after three retries", async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValue(new HttpError(500, "down"));

    const pending = retryChatHistoryRequest(request, active);
    const settled = expect(pending).rejects.toBeInstanceOf(HttpError);
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000);

    await settled;
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("stops when the room is left during the wait", async () => {
    vi.useFakeTimers();
    let isActive = true;
    const request = vi.fn().mockRejectedValue(new HttpError(500, "down"));

    const pending = retryChatHistoryRequest(request, () => isActive);
    const settled = expect(pending).rejects.toBeInstanceOf(HttpError);
    isActive = false;
    await vi.advanceTimersByTimeAsync(1_000);

    await settled;
    expect(request).toHaveBeenCalledTimes(1);
  });
});
