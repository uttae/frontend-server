import type { ServerChatMessage } from "@/types/chat";
import { getRoomMessages } from "@/lib/api/rooms";
import { HttpError } from "@/lib/api/errors";
import { maxSequenceInMessages, normalizeFetchedRoomMessages } from "@/lib/chat";
import { CHAT_MESSAGE_PAGE_SIZE } from "@/lib/chat/readBoundary";

/** 백엔드 GET /messages `size` 상한 */
export const CHAT_CATCH_UP_PAGE_SIZE = 200;

/** TanStack Query 기본 재시도(3회, 1·2·4초)와 같다 */
const CHAT_HISTORY_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

/** 네트워크 오류·5xx·429만 다시 보낸다. 400·403·404는 다시 보내도 같다 */
function isRetryableHistoryError(error: unknown): boolean {
  return (
    !(error instanceof HttpError) ||
    error.status >= 500 ||
    error.status === 429
  );
}

/**
 * 채팅 기록 조회를 실패 종류에 따라 다시 보낸다.
 * `isActive`가 거짓이면(방을 떠났거나 더 새 조회가 시작됨) 기다린 뒤 보내지 않는다.
 */
export async function retryChatHistoryRequest<T>(
  request: () => Promise<T>,
  isActive: () => boolean,
): Promise<T> {
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

/**
 * 커서 뒤의 메시지를 끝까지 받는다.
 * 커서가 없거나 0이면(빈 방·sequence 없는 옛 목록) 최신 페이지를 받는다 —
 * 백엔드는 afterSequence가 1보다 작으면 400을 준다.
 */
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
    if (
      page.length < CHAT_CATCH_UP_PAGE_SIZE ||
      last == null ||
      last <= after ||
      !isActive()
    ) {
      return rows;
    }
    after = last;
  }
}
