import type { ServerChatMessage } from "@/types/chat";
import { getRoomMessages } from "@/lib/api/rooms";
import { normalizeFetchedRoomMessages } from "@/lib/chat";

export function hasOlderHistoryPage(
  fetchedLength: number,
  pageSize: number,
): boolean {
  return fetchedLength >= pageSize;
}

export type InitialRoomHistoryLoadResult = {
  serverSlice: ServerChatMessage[];
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  lastReadMessageId: string | null;
  warmHistory: ServerChatMessage[];
};

async function loadLatestRoomHistoryPage(
  roomId: string,
  pageSize: number,
): Promise<InitialRoomHistoryLoadResult> {
  const history = await getRoomMessages(roomId, { size: pageSize });
  const normalized = normalizeFetchedRoomMessages(history);
  return {
    serverSlice: normalized,
    hasMoreOlder: hasOlderHistoryPage(normalized.length, pageSize),
    hasMoreNewer: false,
    lastReadMessageId: null,
    warmHistory: normalized,
  };
}

export async function loadInitialRoomHistory(
  roomId: string,
  lastReadMessageId: string | null,
  pageSize: number,
): Promise<InitialRoomHistoryLoadResult> {
  if (!lastReadMessageId) {
    return loadLatestRoomHistoryPage(roomId, pageSize);
  }

  const beforeRows = await getRoomMessages(roomId, {
    beforeId: lastReadMessageId,
    size: pageSize,
  });
  const normalizedBefore = normalizeFetchedRoomMessages(beforeRows);

  return {
    serverSlice: normalizedBefore,
    hasMoreOlder: hasOlderHistoryPage(normalizedBefore.length, pageSize),
    hasMoreNewer: true,
    lastReadMessageId,
    warmHistory: normalizedBefore,
  };
}
