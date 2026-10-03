import type { ServerChatMessage } from "@/types/chat";
import { getRoomMessages } from "@/lib/api/rooms";
import {
  mergeServerMessageLists,
  newestServerMessageByCreatedAt,
  normalizeFetchedRoomMessages,
} from "@/lib/chat";
import { hasOlderHistoryPage } from "@/lib/chat/initialRoomHistory";

export const CHAT_MESSAGE_PAGE_SIZE = 15;

/** 패널 열림 세션 동안 고정되는 읽음 구분선 DOM 위치 */
export type ReadDividerPlacement = {
  afterMessageId: string | null;
  beforeFirst: boolean;
};

/** read-status·bridge 후 리스트 스크롤 1회 요청 */
export type ChatScrollAnchorRequest = {
  /** lastReadMessageId — 뷰포트 하단 정렬. undefined면 최하단 */
  anchorId: string | undefined;
  key: number;
};

export const EMPTY_READ_DIVIDER_PLACEMENT: ReadDividerPlacement = {
  afterMessageId: null,
  beforeFirst: false,
};

export function resolveReadDividerPlacement(
  slice: readonly ServerChatMessage[],
  lastReadMessageId: string | null,
  beforeSlice: readonly ServerChatMessage[],
  hasMoreNewer = false,
): ReadDividerPlacement {
  if (!lastReadMessageId) {
    return EMPTY_READ_DIVIDER_PLACEMENT;
  }
  // 경계 뒤에 새 메시지가 없으면 목록 맨 아래에 구분선만 남으므로 그리지 않는다
  const placeAfter = (messageId: string): ReadDividerPlacement =>
    !hasMoreNewer && newestServerMessageByCreatedAt([...slice])?.id === messageId
      ? EMPTY_READ_DIVIDER_PLACEMENT
      : { afterMessageId: messageId, beforeFirst: false };
  if (slice.some((m) => m.id === lastReadMessageId)) {
    return placeAfter(lastReadMessageId);
  }
  const beforeNewest = newestServerMessageByCreatedAt([...beforeSlice]);
  if (beforeNewest) {
    return placeAfter(beforeNewest.id);
  }
  if (slice.length > 0) {
    return { afterMessageId: null, beforeFirst: true };
  }
  return EMPTY_READ_DIVIDER_PLACEMENT;
}

/** beforeId 슬라이스 직후 lastRead·unread 구간 bridge (afterId 1회) */
export async function fetchReadBridgeSlice(
  roomId: string,
  lastReadMessageId: string,
  beforeSlice: readonly ServerChatMessage[],
  pageSize: number = CHAT_MESSAGE_PAGE_SIZE,
): Promise<{ slice: ServerChatMessage[]; hasMoreNewer: boolean }> {
  const cursor =
    newestServerMessageByCreatedAt([...beforeSlice])?.id ?? lastReadMessageId;
  const rows = await getRoomMessages(roomId, {
    afterId: cursor,
    size: pageSize,
  });
  const normalized = normalizeFetchedRoomMessages(rows);
  return {
    slice: normalized,
    hasMoreNewer: hasOlderHistoryPage(normalized.length, pageSize),
  };
}

/** lastRead가 슬라이스에 없으면 bridge merge — 초기 로드·재오픈 공통 */
export async function mergeSliceWithReadBridge(
  roomId: string,
  lastReadMessageId: string,
  slice: ServerChatMessage[],
  beforeSlice: readonly ServerChatMessage[],
  pageSize: number = CHAT_MESSAGE_PAGE_SIZE,
): Promise<{
  slice: ServerChatMessage[];
  /** bridge GET을 수행했을 때만 설정 — 호출 측이 hasMoreNewer 갱신에 사용 */
  bridgedHasMoreNewer: boolean | null;
  bridgedSlice: ServerChatMessage[] | null;
  placementBeforeSlice: readonly ServerChatMessage[];
}> {
  if (slice.some((m) => m.id === lastReadMessageId)) {
    return {
      slice,
      bridgedHasMoreNewer: null,
      bridgedSlice: null,
      placementBeforeSlice: slice,
    };
  }

  const bridge = await fetchReadBridgeSlice(
    roomId,
    lastReadMessageId,
    beforeSlice,
    pageSize,
  );
  return {
    slice: mergeServerMessageLists(slice, bridge.slice),
    bridgedHasMoreNewer: bridge.hasMoreNewer,
    bridgedSlice: bridge.slice,
    placementBeforeSlice: beforeSlice,
  };
}
