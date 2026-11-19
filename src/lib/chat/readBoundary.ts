import type { ServerChatMessage } from "@/types/chat";
import { getRoomMessages } from "@/lib/api/rooms";
import {
  mergeServerMessageLists,
  newestServerMessageByCreatedAt,
  normalizeFetchedRoomMessages,
} from "@/lib/chat";
import { hasOlderHistoryPage } from "@/lib/chat/initialRoomHistory";

export const CHAT_MESSAGE_PAGE_SIZE = 15;

export type ReadDividerPlacement = {
  afterMessageId: string | null;
  beforeFirst: boolean;
};

export type ChatScrollAnchorRequest = {
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

export async function mergeSliceWithReadBridge(
  roomId: string,
  lastReadMessageId: string,
  slice: ServerChatMessage[],
  beforeSlice: readonly ServerChatMessage[],
  pageSize: number = CHAT_MESSAGE_PAGE_SIZE,
): Promise<{
  slice: ServerChatMessage[];
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
