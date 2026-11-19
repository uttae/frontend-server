import type { ServerChatMessage } from "@/types/chat";
import { getRoomMessages } from "@/lib/api/rooms";
import { HttpError } from "@/lib/api/errors";
import { maxSequenceInMessages, normalizeFetchedRoomMessages } from "@/lib/chat";
import { CHAT_MESSAGE_PAGE_SIZE } from "@/lib/chat/readBoundary";

export const CHAT_CATCH_UP_PAGE_SIZE = 200;

const CHAT_HISTORY_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

function isRetryableHistoryError(error: unknown): boolean {
  return !(error instanceof HttpError) || error.status >= 500 || error.status === 429;
}

export async function retryChatHistoryRequest<T>(request: () => Promise<T>, isActive: () => boolean): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const delay = CHAT_HISTORY_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRetryableHistoryError(error) || !isActive()) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (!isActive()) throw error;
    }
  }
}

export async function fetchRoomMessagesAfter(
  roomId: string,
  cursor: number | undefined,
  isActive: () => boolean,
): Promise<ServerChatMessage[]> {
  if (cursor == null || cursor < 1) {
    const latest = await retryChatHistoryRequest(
      () => getRoomMessages(roomId, { size: CHAT_MESSAGE_PAGE_SIZE }),
      isActive,
    );
    return normalizeFetchedRoomMessages(latest);
  }

  const rows: ServerChatMessage[] = [];
  let after = cursor;
  for (;;) {
    const page = normalizeFetchedRoomMessages(
      await retryChatHistoryRequest(
        () =>
          getRoomMessages(roomId, {
            afterSequence: String(after),
            size: CHAT_CATCH_UP_PAGE_SIZE,
          }),
        isActive,
      ),
    );
    rows.push(...page);
    const last = maxSequenceInMessages(page);
    if (page.length < CHAT_CATCH_UP_PAGE_SIZE || last == null || last <= after || !isActive()) {
      return rows;
    }
    after = last;
  }
}
