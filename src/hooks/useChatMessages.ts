import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ServerChatMessage } from "@/types/chat";
import {
  chatMessageUserIds,
  deriveAiRequestConversationState,
  maxSequenceInMessages,
  mergeServerMessageLists,
  newestServerMessageByCreatedAt,
  normalizeFetchedRoomMessages,
  oldestServerMessageByCreatedAt,
  parseFiniteNumber,
  partitionLiveMessages,
  replaceExistingServerMessages,
  serverMessageToChatMessage,
  tailCursorOf,
} from "@/lib/chat";
import { useStompContext } from "@/contexts/StompContext";
import { useSessionUser } from "@/hooks/useSessionUser";
import { getRoomMessageReadStatus, getRoomMessages } from "@/lib/api/rooms";
import type { RoomMember } from "@/lib/api/rooms";
import { useRoomMembers } from "@/hooks/useRooms";
import { invalidateAfterChange } from "@/lib/query-client";
import { roomMembersQueryKey } from "@/lib/query-keys";
import { useChatActions } from "@/hooks/useChatActions";
import { useChatMessageRead } from "@/hooks/useChatMessageRead";
import { warmPlacePhotoQueriesFromChatHistory } from "@/lib/places/warmChatHistoryPlacePhotos";
import { hasOlderHistoryPage, loadInitialRoomHistory } from "@/lib/chat/initialRoomHistory";
import { fetchRoomMessagesAfter, retryChatHistoryRequest } from "@/lib/chat/messageCatchUp";
import {
  CHAT_MESSAGE_PAGE_SIZE,
  EMPTY_READ_DIVIDER_PLACEMENT,
  mergeSliceWithReadBridge,
  resolveReadDividerPlacement,
  type ChatScrollAnchorRequest,
  type ReadDividerPlacement,
} from "@/lib/chat/readBoundary";

export type UseChatMessagesOptions = {
  fetchHistory: boolean;
};

type CatchUpReason = "gap" | "reconnect" | "reopen";

const CATCH_UP_REASON_PRIORITY: Record<CatchUpReason, number> = {
  gap: 0,
  reconnect: 1,
  reopen: 2,
};

function chatHistoryGateKey(uid: number | null | undefined, roomId: string): string {
  return `${uid ?? "anon"}:${roomId.trim()}`;
}

async function loadRoomHistorySnapshot(roomId: string) {
  const { lastReadMessageId } = await getRoomMessageReadStatus(roomId);
  const out = await loadInitialRoomHistory(roomId, lastReadMessageId, CHAT_MESSAGE_PAGE_SIZE);
  const serverSlice = mergeServerMessageLists(out.serverSlice);
  if (!out.lastReadMessageId) {
    return { ...out, slice: serverSlice, placementBeforeSlice: serverSlice };
  }

  const bridged = await mergeSliceWithReadBridge(roomId, out.lastReadMessageId, serverSlice, serverSlice);
  return {
    ...out,
    slice: bridged.slice,
    placementBeforeSlice: bridged.placementBeforeSlice,
    hasMoreNewer: bridged.bridgedHasMoreNewer ?? out.hasMoreNewer,
    warmHistory: bridged.bridgedSlice?.length
      ? mergeServerMessageLists(out.warmHistory, bridged.bridgedSlice)
      : out.warmHistory,
  };
}

export function useChatMessages(roomId: string | null, options: UseChatMessagesOptions) {
  const { fetchHistory } = options;
  const queryClient = useQueryClient();
  const { setRoomChatMessageHandler, connected } = useStompContext();
  const { data: sessionUser } = useSessionUser();
  const userId = sessionUser?.id;
  const { data: membersData, isPending: membersPending, isFetching: membersFetching } = useRoomMembers(roomId);
  const [rawMessages, setRawMessages] = useState<ServerChatMessage[]>([]);
  const [awaitingNameIds, setAwaitingNameIds] = useState<ReadonlySet<string>>(() => new Set());
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [isFetchingNewer, setIsFetchingNewer] = useState(false);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [readMarkerMessageId, setReadMarkerMessageId] = useState<string | null>(null);
  const [readDividerPlacement, setReadDividerPlacement] = useState<ReadDividerPlacement>(EMPTY_READ_DIVIDER_PLACEMENT);
  const [scrollToAnchor, setScrollToAnchor] = useState<ChatScrollAnchorRequest | null>(null);
  const [renderedContext, setRenderedContext] = useState({ roomId, userId, fetchHistory });
  const [roomSnapshots, setRoomSnapshots] = useState<
    Record<
      string,
      {
        rawMessages: ServerChatMessage[];
        hasMore: boolean;
        hasMoreNewer: boolean;
        readMarkerMessageId: string | null;
        readDividerPlacement: ReadDividerPlacement;
      }
    >
  >({});
  if (renderedContext.roomId !== roomId || renderedContext.userId !== userId) {
    const sameUser = renderedContext.userId === userId;
    const saved = sameUser && roomId ? roomSnapshots[roomId] : undefined;
    setRoomSnapshots(
      sameUser && roomId && renderedContext.roomId
        ? {
            ...roomSnapshots,
            [renderedContext.roomId]: { rawMessages, hasMore, hasMoreNewer, readMarkerMessageId, readDividerPlacement },
          }
        : {},
    );
    setRawMessages(saved?.rawMessages ?? []);
    setHasMore(saved?.hasMore ?? true);
    setHasMoreNewer(saved?.hasMoreNewer ?? false);
    setReadMarkerMessageId(saved?.readMarkerMessageId ?? null);
    setReadDividerPlacement(saved?.readDividerPlacement ?? EMPTY_READ_DIVIDER_PLACEMENT);
    setIsFetchingOlder(false);
    setIsFetchingNewer(false);
    setScrollToAnchor(null);
    setRenderedContext({ roomId, userId, fetchHistory });
  } else if (renderedContext.fetchHistory !== fetchHistory) {
    setRenderedContext({ roomId, userId, fetchHistory });
    if (!fetchHistory) {
      setReadMarkerMessageId(null);
      setReadDividerPlacement(EMPTY_READ_DIVIDER_PLACEMENT);
      setScrollToAnchor(null);
    }
  }
  const { sendChatMessage, sendAiMessage, sendCancelAiRequest } = useChatActions();

  const prevRoomForHistoryGateRef = useRef<string | null>(null);
  const prevFetchHistoryRef = useRef(false);
  const reopenScrollKeyRef = useRef(0);
  const readBoundaryRestoreVersionRef = useRef(0);
  const activeRoomIdRef = useRef("");
  const fetchHistoryRef = useRef(fetchHistory);
  const wasConnectedRef = useRef(connected);
  const historyFetchedRoomIdsRef = useRef<Set<string>>(new Set());
  const hasMoreByRoomRef = useRef<Map<string, boolean>>(new Map());
  const hasMoreNewerByRoomRef = useRef<Map<string, boolean>>(new Map());
  const cursorByRoomRef = useRef<Map<string, number>>(new Map());
  const lastReadMarkerByRoomRef = useRef<Map<string, string>>(new Map());
  const readDividerPlacementByRoomRef = useRef<Map<string, ReadDividerPlacement>>(new Map());
  const tailSyncTokenRef = useRef(0);
  const liveBufferRef = useRef<ServerChatMessage[] | null>(null);
  const pendingCatchUpRef = useRef<CatchUpReason | null>(null);
  const requestCatchUpRef = useRef<(rid: string, reason: CatchUpReason) => void>(() => {});
  const isFetchingOlderRef = useRef(false);
  const isFetchingNewerRef = useRef(false);
  const rawMessagesRef = useRef<ServerChatMessage[]>([]);
  const membersRef = useRef(membersData);

  const roomLifetimeRef = useRef(0);
  useLayoutEffect(() => {
    roomLifetimeRef.current += 1;
    isFetchingOlderRef.current = false;
    isFetchingNewerRef.current = false;
    liveBufferRef.current = null;
    pendingCatchUpRef.current = null;
    return () => {
      roomLifetimeRef.current += 1;
    };
  }, [roomId, userId]);

  useLayoutEffect(() => {
    rawMessagesRef.current = rawMessages;
    activeRoomIdRef.current = roomId?.trim() ?? "";
    fetchHistoryRef.current = fetchHistory;
    membersRef.current = membersData;
  }, [rawMessages, roomId, fetchHistory, membersData]);

  const { markMessagesRead, resetReadDedup, onIncomingMessage } = useChatMessageRead({
    roomId,
    panelOpen: fetchHistory,
    rawMessagesRef,
  });

  const memberMap = useMemo(() => {
    const members = membersData?.members;
    if (!members?.length) {
      return new Map<number, Pick<RoomMember, "nickname" | "profileImageUrl">>();
    }
    return new Map(
      members.map((m) => {
        const uid = parseFiniteNumber(m.userId) ?? m.userId;
        return [uid, { nickname: m.nickname, profileImageUrl: m.profileImageUrl }] as const;
      }),
    );
  }, [membersData?.members]);

  const { fulfilledAiRequestIds, aiRequestReplyLookup } = useMemo(
    () => deriveAiRequestConversationState(rawMessages),
    [rawMessages],
  );

  const roomMembersResolved = Boolean(membersData);

  const messages = useMemo(
    () =>
      rawMessages
        .filter((m) => {
          const nameMissing = chatMessageUserIds(m).some((id) => id !== userId && !memberMap.has(id));
          return !(nameMissing && (membersPending || (membersFetching && awaitingNameIds.has(m.id))));
        })
        .map((m) =>
          serverMessageToChatMessage(
            m,
            userId,
            memberMap,
            fulfilledAiRequestIds,
            aiRequestReplyLookup,
            roomMembersResolved,
          ),
        ),
    [
      rawMessages,
      userId,
      memberMap,
      fulfilledAiRequestIds,
      aiRequestReplyLookup,
      roomMembersResolved,
      membersPending,
      membersFetching,
      awaitingNameIds,
    ],
  );

  const publishScrollToAnchor = useCallback((lastReadMessageId: string | null | undefined) => {
    reopenScrollKeyRef.current += 1;
    setScrollToAnchor({
      anchorId: lastReadMessageId ?? undefined,
      key: reopenScrollKeyRef.current,
    });
  }, []);

  const applySessionReadBoundary = useCallback(
    (rid: string, lastReadMessageId: string | null, placement: ReadDividerPlacement) => {
      if (lastReadMessageId) {
        lastReadMarkerByRoomRef.current.set(rid, lastReadMessageId);
        readDividerPlacementByRoomRef.current.set(rid, placement);
        setReadMarkerMessageId(lastReadMessageId);
      } else {
        lastReadMarkerByRoomRef.current.delete(rid);
        readDividerPlacementByRoomRef.current.delete(rid);
        setReadMarkerMessageId(null);
      }
      setReadDividerPlacement(placement);
    },
    [],
  );

  const clearSessionReadBoundary = useCallback((rid: string) => {
    lastReadMarkerByRoomRef.current.delete(rid);
    readDividerPlacementByRoomRef.current.delete(rid);
    setReadMarkerMessageId(null);
    setReadDividerPlacement(EMPTY_READ_DIVIDER_PLACEMENT);
  }, []);

  const canRenderReadDivider = useCallback(
    (slice: readonly ServerChatMessage[], placement: ReadDividerPlacement) =>
      (placement.beforeFirst && slice.length > 0) ||
      (placement.afterMessageId != null && slice.some((message) => message.id === placement.afterMessageId)),
    [],
  );

  const restoreSessionReadBoundary = useCallback(
    (targetRoomId: string) => {
      const rid = targetRoomId.trim();
      if (!rid) return;

      const version = ++readBoundaryRestoreVersionRef.current;
      const isCurrentRequest = () =>
        readBoundaryRestoreVersionRef.current === version && fetchHistoryRef.current && activeRoomIdRef.current === rid;

      return getRoomMessageReadStatus(targetRoomId)
        .then(async ({ lastReadMessageId }) => {
          if (!isCurrentRequest()) return;

          if (!lastReadMessageId) {
            applySessionReadBoundary(rid, null, EMPTY_READ_DIVIDER_PLACEMENT);
            return;
          }

          const beforeSlice = [...rawMessagesRef.current];
          const bridged = await mergeSliceWithReadBridge(targetRoomId, lastReadMessageId, beforeSlice, beforeSlice);
          if (!isCurrentRequest()) return;

          const bridgedSlice = bridged.bridgedSlice;
          const bridgedHasMoreNewer = bridged.bridgedHasMoreNewer;
          if (bridgedSlice && bridgedHasMoreNewer != null) {
            hasMoreNewerByRoomRef.current.set(rid, bridgedHasMoreNewer);
            setHasMoreNewer(bridgedHasMoreNewer);
            setRawMessages((prev) => mergeServerMessageLists(prev, bridgedSlice));
            const last = maxSequenceInMessages(bridgedSlice);
            const cursor = cursorByRoomRef.current.get(rid);
            if (bridgedHasMoreNewer) {
              cursorByRoomRef.current.delete(rid);
            } else if (last != null) {
              cursorByRoomRef.current.set(rid, Math.max(cursor ?? last, last));
            }
            void warmPlacePhotoQueriesFromChatHistory(queryClient, bridgedSlice);
          }

          const placement = resolveReadDividerPlacement(
            bridged.slice,
            lastReadMessageId,
            bridged.placementBeforeSlice,
            hasMoreNewerByRoomRef.current.get(rid) === true,
          );
          applySessionReadBoundary(rid, lastReadMessageId, placement);

          if (canRenderReadDivider(bridged.slice, placement)) {
            publishScrollToAnchor(lastReadMessageId);
          }
        })
        .catch(() => {
          if (!isCurrentRequest()) return;
          const fallbackLastRead = lastReadMarkerByRoomRef.current.get(rid);
          const fallbackPlacement = readDividerPlacementByRoomRef.current.get(rid);
          if (
            fallbackLastRead &&
            fallbackPlacement &&
            canRenderReadDivider(rawMessagesRef.current, fallbackPlacement)
          ) {
            setReadMarkerMessageId(fallbackLastRead);
            setReadDividerPlacement(fallbackPlacement);
            publishScrollToAnchor(fallbackLastRead);
          }
        });
    },
    [applySessionReadBoundary, canRenderReadDivider, publishScrollToAnchor, queryClient],
  );

  const beginTailSync = useCallback(() => {
    tailSyncTokenRef.current += 1;
    liveBufferRef.current ??= [];
    const token = tailSyncTokenRef.current;
    const lifetime = roomLifetimeRef.current;
    return () => tailSyncTokenRef.current === token && roomLifetimeRef.current === lifetime;
  }, []);

  const applyLiveMessages = useCallback(
    (rid: string, msgs: readonly ServerChatMessage[], catchUpOnGap: boolean) => {
      if (msgs.length === 0 || !historyFetchedRoomIdsRef.current.has(chatHistoryGateKey(userId, rid))) {
        return;
      }

      const { appended, updates, cursor, hasGap } = partitionLiveMessages(msgs, {
        cursor: cursorByRoomRef.current.get(rid),
        atTail: hasMoreNewerByRoomRef.current.get(rid) !== true,
        list: rawMessagesRef.current,
      });
      if (cursor != null) cursorByRoomRef.current.set(rid, cursor);
      if (appended.length > 0 || updates.length > 0) {
        setRawMessages((prev) => {
          const updated = replaceExistingServerMessages(prev, updates);
          return appended.length > 0 ? mergeServerMessageLists(updated, appended) : updated;
        });
      }
      if (hasGap && catchUpOnGap) requestCatchUpRef.current(rid, "gap");

      const newest = appended[appended.length - 1];
      if (newest) onIncomingMessage(newest, true);
    },
    [userId, onIncomingMessage],
  );

  const finishTailSync = useCallback(
    (rid: string, succeeded: boolean) => {
      const buffered = liveBufferRef.current ?? [];
      liveBufferRef.current = null;
      applyLiveMessages(rid, buffered, succeeded);
      const pending = pendingCatchUpRef.current;
      pendingCatchUpRef.current = null;
      if (pending) requestCatchUpRef.current(rid, pending);
    },
    [applyLiveMessages],
  );

  const showCaughtUpMessages = useCallback(
    (
      rid: string,
      reason: CatchUpReason,
      appended: readonly ServerChatMessage[],
      newestBefore: ServerChatMessage | null,
    ) => {
      if (reason === "reopen") {
        void restoreSessionReadBoundary(rid);
        return;
      }
      const newest = appended[appended.length - 1];
      if (!newest) return;
      if (reason === "gap") {
        onIncomingMessage(newest, true);
        return;
      }
      if (!newestBefore || !fetchHistoryRef.current) return;
      applySessionReadBoundary(rid, newestBefore.id, {
        afterMessageId: newestBefore.id,
        beforeFirst: false,
      });
      publishScrollToAnchor(newestBefore.id);
    },
    [restoreSessionReadBoundary, onIncomingMessage, applySessionReadBoundary, publishScrollToAnchor],
  );

  const requestCatchUp = useCallback(
    (rid: string, reason: CatchUpReason) => {
      if (liveBufferRef.current) {
        const pending = pendingCatchUpRef.current;
        if (!pending || CATCH_UP_REASON_PRIORITY[reason] > CATCH_UP_REASON_PRIORITY[pending]) {
          pendingCatchUpRef.current = reason;
        }
        return;
      }
      if (!historyFetchedRoomIdsRef.current.has(chatHistoryGateKey(userId, rid))) {
        return;
      }
      if (hasMoreNewerByRoomRef.current.get(rid) === true) {
        if (reason === "reopen") void restoreSessionReadBoundary(rid);
        return;
      }

      const isCurrent = beginTailSync();
      const cursor = cursorByRoomRef.current.get(rid);
      const newestBefore = newestServerMessageByCreatedAt(rawMessagesRef.current);
      void fetchRoomMessagesAfter(rid, cursor, isCurrent)
        .then((rows) => {
          if (!isCurrent()) return;
          const known = new Set(rawMessagesRef.current.map((m) => m.id));
          const appended = rows.filter((m) => !known.has(m.id));
          setRawMessages((prev) => mergeServerMessageLists(prev, rows));
          const last = maxSequenceInMessages(rows);
          if (last != null) {
            cursorByRoomRef.current.set(rid, Math.max(cursor ?? last, last));
          }
          if (cursor === 0) {
            const more = hasOlderHistoryPage(rows.length, CHAT_MESSAGE_PAGE_SIZE);
            hasMoreByRoomRef.current.set(rid, more);
            setHasMore(more);
          }
          void warmPlacePhotoQueriesFromChatHistory(queryClient, rows);
          showCaughtUpMessages(rid, reason, appended, newestBefore);
          finishTailSync(rid, true);
        })
        .catch(() => {
          if (!isCurrent()) return;
          finishTailSync(rid, false);
          if (reason === "reopen") void restoreSessionReadBoundary(rid);
        });
    },
    [userId, queryClient, beginTailSync, finishTailSync, showCaughtUpMessages, restoreSessionReadBoundary],
  );

  useLayoutEffect(() => {
    requestCatchUpRef.current = requestCatchUp;
  }, [requestCatchUp]);

  const startHistoryLoad = useCallback(
    (targetRoomId: string) => {
      const rid = targetRoomId.trim();
      const isCurrent = beginTailSync();
      void retryChatHistoryRequest(() => loadRoomHistorySnapshot(targetRoomId), isCurrent)
        .then((out) => {
          if (!isCurrent()) return;
          hasMoreByRoomRef.current.set(rid, out.hasMoreOlder);
          hasMoreNewerByRoomRef.current.set(rid, out.hasMoreNewer);
          setHasMore(out.hasMoreOlder);
          setHasMoreNewer(out.hasMoreNewer);

          const placement = out.lastReadMessageId
            ? resolveReadDividerPlacement(out.slice, out.lastReadMessageId, out.placementBeforeSlice, out.hasMoreNewer)
            : EMPTY_READ_DIVIDER_PLACEMENT;
          applySessionReadBoundary(rid, out.lastReadMessageId, placement);

          setRawMessages(out.slice);
          const cursor = out.hasMoreNewer ? undefined : tailCursorOf(out.slice);
          if (cursor == null) cursorByRoomRef.current.delete(rid);
          else cursorByRoomRef.current.set(rid, cursor);
          historyFetchedRoomIdsRef.current.add(chatHistoryGateKey(userId, rid));
          void warmPlacePhotoQueriesFromChatHistory(queryClient, out.warmHistory);

          const newest = newestServerMessageByCreatedAt(out.slice);
          if (newest && !out.hasMoreNewer) {
            resetReadDedup();
            markMessagesRead(newest.id);
          }

          if (out.lastReadMessageId && canRenderReadDivider(out.slice, placement)) {
            publishScrollToAnchor(out.lastReadMessageId);
          }
          finishTailSync(rid, true);
        })
        .catch(() => {
          if (isCurrent()) finishTailSync(rid, false);
        });
    },
    [
      userId,
      queryClient,
      beginTailSync,
      finishTailSync,
      applySessionReadBoundary,
      canRenderReadDivider,
      publishScrollToAnchor,
      markMessagesRead,
      resetReadDedup,
    ],
  );

  useEffect(() => {
    if (!roomId) {
      readBoundaryRestoreVersionRef.current += 1;
      prevRoomForHistoryGateRef.current = null;
      prevFetchHistoryRef.current = false;
      historyFetchedRoomIdsRef.current.clear();
      hasMoreByRoomRef.current.clear();
      hasMoreNewerByRoomRef.current.clear();
      cursorByRoomRef.current.clear();
      lastReadMarkerByRoomRef.current.clear();
      readDividerPlacementByRoomRef.current.clear();
      return;
    }

    if (!fetchHistory) {
      readBoundaryRestoreVersionRef.current += 1;
      prevRoomForHistoryGateRef.current = roomId;
      prevFetchHistoryRef.current = false;
      return;
    }

    const reopened = !prevFetchHistoryRef.current || prevRoomForHistoryGateRef.current !== roomId;
    prevFetchHistoryRef.current = true;
    prevRoomForHistoryGateRef.current = roomId;
    if (userId == null) return;

    const rid = roomId.trim();
    if (historyFetchedRoomIdsRef.current.has(chatHistoryGateKey(userId, rid))) {
      if (!reopened) return;
      queueMicrotask(() => {
        if (activeRoomIdRef.current === rid) requestCatchUp(rid, "reopen");
      });
      return;
    }
    if (!liveBufferRef.current) startHistoryLoad(roomId);
  }, [roomId, fetchHistory, userId, requestCatchUp, startHistoryLoad]);

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = connected;
    if (!connected || wasConnected || !roomId || userId == null) return;

    const rid = roomId.trim();
    queueMicrotask(() => {
      if (activeRoomIdRef.current !== rid) return;
      if (liveBufferRef.current || historyFetchedRoomIdsRef.current.has(chatHistoryGateKey(userId, rid))) {
        requestCatchUp(rid, "reconnect");
      } else if (fetchHistoryRef.current) {
        startHistoryLoad(roomId);
      }
    });
  }, [connected, roomId, userId, requestCatchUp, startHistoryLoad]);

  const fetchOlderMessages = useCallback(() => {
    const rid = roomId?.trim();
    if (!rid || activeRoomIdRef.current !== rid) return;
    if (isFetchingOlderRef.current) return;
    if (hasMoreByRoomRef.current.get(rid) === false) return;

    const oldest = oldestServerMessageByCreatedAt(rawMessagesRef.current);
    if (!oldest) return;

    isFetchingOlderRef.current = true;
    const lifetime = roomLifetimeRef.current;
    setIsFetchingOlder(true);

    void getRoomMessages(rid, {
      beforeId: oldest.id,
      size: CHAT_MESSAGE_PAGE_SIZE,
    })
      .then((history) => {
        if (roomLifetimeRef.current !== lifetime) return;
        const normalizedHistory = normalizeFetchedRoomMessages(history);
        const more = hasOlderHistoryPage(normalizedHistory.length, CHAT_MESSAGE_PAGE_SIZE);
        hasMoreByRoomRef.current.set(rid, more);
        setHasMore(more);
        setRawMessages((prev) => mergeServerMessageLists(normalizedHistory, prev));
        void warmPlacePhotoQueriesFromChatHistory(queryClient, normalizedHistory);
      })
      .catch(() => {})
      .finally(() => {
        if (roomLifetimeRef.current !== lifetime) return;
        isFetchingOlderRef.current = false;
        setIsFetchingOlder(false);
      });
  }, [roomId, queryClient]);

  const fetchNewerMessages = useCallback(() => {
    const rid = roomId?.trim();
    if (!rid || activeRoomIdRef.current !== rid) return;
    if (isFetchingNewerRef.current) return;
    if (hasMoreNewerByRoomRef.current.get(rid) !== true) return;

    const newest = newestServerMessageByCreatedAt(rawMessagesRef.current);
    if (!newest) return;

    isFetchingNewerRef.current = true;
    const lifetime = roomLifetimeRef.current;
    setIsFetchingNewer(true);
    const isCurrent = beginTailSync();

    void getRoomMessages(rid, {
      afterId: newest.id,
      size: CHAT_MESSAGE_PAGE_SIZE,
    })
      .then((history) => {
        if (!isCurrent()) return;
        const normalizedHistory = normalizeFetchedRoomMessages(history);
        const more = hasOlderHistoryPage(normalizedHistory.length, CHAT_MESSAGE_PAGE_SIZE);
        hasMoreNewerByRoomRef.current.set(rid, more);
        setHasMoreNewer(more);
        setRawMessages((prev) => mergeServerMessageLists(prev, normalizedHistory));
        if (!more) {
          const last = maxSequenceInMessages([...rawMessagesRef.current, ...normalizedHistory]);
          if (last == null) cursorByRoomRef.current.delete(rid);
          else cursorByRoomRef.current.set(rid, last);
        }
        void warmPlacePhotoQueriesFromChatHistory(queryClient, normalizedHistory);
        finishTailSync(rid, true);
      })
      .catch(() => {
        if (isCurrent()) finishTailSync(rid, false);
      })
      .finally(() => {
        if (roomLifetimeRef.current !== lifetime) return;
        isFetchingNewerRef.current = false;
        setIsFetchingNewer(false);
      });
  }, [roomId, queryClient, beginTailSync, finishTailSync]);

  const jumpToLatest = useCallback(() => {
    const rid = roomId?.trim();
    if (!rid || activeRoomIdRef.current !== rid) return;

    const isCurrent = beginTailSync();
    void getRoomMessages(rid, { size: CHAT_MESSAGE_PAGE_SIZE })
      .then((history) => {
        if (!isCurrent()) return;
        const normalized = normalizeFetchedRoomMessages(history);
        const more = hasOlderHistoryPage(normalized.length, CHAT_MESSAGE_PAGE_SIZE);
        hasMoreByRoomRef.current.set(rid, more);
        hasMoreNewerByRoomRef.current.set(rid, false);
        const cursor = tailCursorOf(normalized);
        if (cursor == null) cursorByRoomRef.current.delete(rid);
        else cursorByRoomRef.current.set(rid, cursor);
        clearSessionReadBoundary(rid);
        setHasMore(more);
        setHasMoreNewer(false);
        setRawMessages(mergeServerMessageLists(normalized));
        publishScrollToAnchor(undefined);
        void warmPlacePhotoQueriesFromChatHistory(queryClient, normalized);
        finishTailSync(rid, true);
      })
      .catch(() => {
        if (isCurrent()) finishTailSync(rid, false);
      });
  }, [roomId, queryClient, beginTailSync, finishTailSync, clearSessionReadBoundary, publishScrollToAnchor]);

  useEffect(() => {
    if (!roomId) {
      setRoomChatMessageHandler(null);
      return;
    }

    const rid = roomId.trim();
    const handler = (msg: ServerChatMessage) => {
      if (activeRoomIdRef.current !== rid) return;
      const members = membersRef.current?.members ?? [];
      const nameMissing = chatMessageUserIds(msg).some((id) => id !== userId && !members.some((m) => m.userId === id));
      if (nameMissing) {
        void invalidateAfterChange(queryClient, { queryKey: roomMembersQueryKey(rid), exact: true });
        setAwaitingNameIds((prev) => new Set(prev).add(msg.id));
      }
      if (liveBufferRef.current) {
        liveBufferRef.current.push(msg);
        return;
      }
      applyLiveMessages(rid, [msg], true);
    };
    setRoomChatMessageHandler(handler);
    return () => setRoomChatMessageHandler(null);
  }, [roomId, userId, queryClient, setRoomChatMessageHandler, applyLiveMessages]);

  const rid = roomId?.trim() ?? "";
  const effectiveReadMarkerMessageId = fetchHistory && rid ? readMarkerMessageId : null;
  const effectiveReadDividerPlacement: ReadDividerPlacement | null =
    fetchHistory && rid
      ? readDividerPlacement.afterMessageId != null || readDividerPlacement.beforeFirst
        ? readDividerPlacement
        : null
      : null;

  return {
    messages,
    waitingForMembers: Boolean(roomId) && membersPending,
    sendChatMessage,
    sendAiMessage,
    sendCancelAiRequest,
    fetchOlderMessages,
    fetchNewerMessages,
    jumpToLatest,
    hasMore,
    hasMoreNewer,
    isFetchingOlder,
    isFetchingNewer,
    readMarkerMessageId: effectiveReadMarkerMessageId,
    readDividerPlacement: effectiveReadDividerPlacement,
    scrollToAnchor,
    markMessagesRead,
  };
}
