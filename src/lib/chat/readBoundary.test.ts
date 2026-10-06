import { expect, it, vi } from "vitest";
import type { ServerChatMessage } from "@/types/chat";
import {
  EMPTY_READ_DIVIDER_PLACEMENT,
  resolveReadDividerPlacement,
} from "./readBoundary";

vi.mock("@/lib/api/rooms", () => ({ getRoomMessages: vi.fn() }));

function msg(id: string, minute: number): ServerChatMessage {
  return {
    id,
    roomId: "room",
    senderId: 1,
    messageType: "CHAT",
    content: id,
    createdAt: `2026-10-01T00:${String(minute).padStart(2, "0")}:00Z`,
  };
}

const slice = [msg("a", 0), msg("b", 1)];

it("does not draw the read divider when nothing comes after the last read message", () => {
  expect(resolveReadDividerPlacement(slice, "b", slice)).toEqual(
    EMPTY_READ_DIVIDER_PLACEMENT,
  );
});

it("draws the read divider before unread messages", () => {
  expect(resolveReadDividerPlacement(slice, "a", slice)).toEqual({
    afterMessageId: "a",
    beforeFirst: false,
  });
});

it("keeps the divider at the loaded tail when newer pages remain", () => {
  expect(resolveReadDividerPlacement(slice, "b", slice, true)).toEqual({
    afterMessageId: "b",
    beforeFirst: false,
  });
});
