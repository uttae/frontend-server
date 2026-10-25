import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ServerChatMessage } from "@/types/chat";
import {
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
import { useChatActions } from "@/hooks/useChatActions";
import { useChatMessageRead } from "@/hooks/useChatMessageRead";
import { warmPlacePhotoQueriesFromChatHistory } from "@/lib/places/warmChatHistoryPlacePhotos";
import {
  hasOlderHistoryPage,
  loadInitialRoomHistory,
} from "@/lib/chat/initialRoomHistory";
import {
  fetchRoomMessagesAfter,
  retryChatHistoryRequest,
} from "@/lib/chat/messageCatchUp";
import {
  CHAT_MESSAGE_PAGE_SIZE,
  EMPTY_READ_DIVIDER_PLACEMENT,
  mergeSliceWithReadBridge,
  resolveReadDividerPlacement,
  type ChatScrollAnchorRequest,
  type ReadDividerPlacement,
} from "@/lib/chat/readBoundary";

export type UseChatMessagesOptions = {
  /**
   * `false`: 패널 닫힘 — GET 없음. STOMP만 유지.
   * `true`: 이 `roomId`에 대해 **이번 페이지 수명 내 아직 GET을 한 적 없을 때만** 히스토리 GET.
   * (닫았다 다시 열 때는 같은 방이면 놓친 메시지만 따라잡고 read-status로 마커·스크롤을 복원.)
   */
  fetchHistory: boolean;
};

/**
 * 빈 번호를 따라잡는 이유 — 따라잡은 뒤 화면 처리가 다르다.
 * - gap: 실시간 수신 중 번호가 비었다. 받은 메시지는 실시간 메시지처럼 읽음 처리한다
 * - reconnect: 끊긴 동안 놓쳤다. 새로 붙은 메시지 앞에 구분선을 두고 그 자리로 스크롤한다
 * - reopen: 다른 방에 다녀왔거나 패널을 다시 열었다. 읽음 경계를 서버 기준으로 복원한다
 */
type CatchUpReason = "gap" | "reconnect" | "reopen";

const CATCH_UP_REASON_PRIORITY: Record<CatchUpReason, number> = {
  gap: 0,
  reconnect: 1,
  reopen: 2,
};

function chatHistoryGateKey(
  uid: number | null | undefined,
  roomId: string,
): string {
  return `${uid ?? "anon"}:${roomId.trim()}`;
}

/** 패널 최초 기록 — 읽음 위치 앞 페이지에, 읽음 위치부터 이어지는 페이지를 붙인다 */
async function loadRoomHistorySnapshot(roomId: string) {
  const { lastReadMessageId } = await getRoomMessageReadStatus(roomId);
  const out = await loadInitialRoomHistory(
    roomId,
    lastReadMessageId,
    CHAT_MESSAGE_PAGE_SIZE,
  );
  // 서버는 페이지를 sequence·문서 id 순으로 준다 — 화면은 작성 시각 순으로 맞춘다
  const serverSlice = mergeServerMessageLists(out.serverSlice);
  if (!out.lastReadMessageId) {
    return { ...out, slice: serverSlice, placementBeforeSlice: serverSlice };
  }

  const bridged = await mergeSliceWithReadBridge(
    roomId,
    out.lastReadMessageId,
    serverSlice,
    serverSlice,
  );
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

export function useChatMessages(
  roomId: string | null,
  options: UseChatMessagesOptions,
) {
  const { fetchHistory } = options;
  const queryClient = useQueryClient();
  const { setRoomChatMessageHandler, connected } = useStompContext();
  const { data: sessionUser } = useSessionUser();
  const userId = sessionUser?.id;
  const { data: membersData } = useRoomMembers(roomId);
  const [rawMessages, setRawMessages] = useState<ServerChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [isFetchingNewer, setIsFetchingNewer] = useState(false);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [readMarkerMessageId, setReadMarkerMessageId] = useState<
    string | null
  >(null);
  const [readDividerPlacement, setReadDividerPlacement] =
    useState<ReadDividerPlacement>(EMPTY_READ_DIVIDER_PLACEMENT);
  const [scrollToAnchor, setScrollToAnchor] =
    useState<ChatScrollAnchorRequest | null>(null);
  const [renderedContext, setRenderedContext] = useState({ roomId, userId, fetchHistory });
  const [roomSnapshots, setRoomSnapshots] = useState<Record<string, {
    rawMessages: ServerChatMessage[];
    hasMore: boolean;
    hasMoreNewer: boolean;
    readMarkerMessageId: string | null;
    readDividerPlacement: ReadDividerPlacement;
  }>>({});
  if (renderedContext.roomId !== roomId || renderedContext.userId !== userId) {
    const sameUser = renderedContext.userId === userId;
    const saved = sameUser && roomId ? roomSnapshots[roomId] : undefined;
    setRoomSnapshots(sameUser && roomId && renderedContext.roomId ? {
      ...roomSnapshots,
      [renderedContext.roomId]: { rawMessages, hasMore, hasMoreNewer, readMarkerMessageId, readDividerPlacement },
    } : {});
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
  const { sendChatMessage, sendAiMessage, sendCancelAiRequest } =
    useChatActions();

  const prevRoomForHistoryGateRef = useRef<string | null>(null);
  const prevFetchHistoryRef = useRef(false);
  const reopenScrollKeyRef = useRef(0);
  const readBoundaryRestoreVersionRef = useRef(0);
  const activeRoomIdRef = useRef("");
  const fetchHistoryRef = useRef(fetchHistory);
  /** 마운트 때 이미 연결돼 있었으면 구독이 최초 기록 조회보다 먼저다 — 그 뒤의 재연결만 따라잡는다 */
  const wasConnectedRef = useRef(connected);
  const historyFetchedRoomIdsRef = useRef<Set<string>>(new Set());
  const hasMoreByRoomRef = useRef<Map<string, boolean>>(new Map());
  const hasMoreNewerByRoomRef = useRef<Map<string, boolean>>(new Map());
  /** 목록 끝까지 빠짐없이 반영한 마지막 sequence. 목록이 최신 끝일 때만 둔다 */
  const cursorByRoomRef = useRef<Map<string, number>>(new Map());
  const lastReadMarkerByRoomRef = useRef<Map<string, string>>(new Map());
  const readDividerPlacementByRoomRef = useRef<Map<string, ReadDividerPlacement>>(
    new Map(),
  );
  /**
   * 목록 끝을 바꾸는 조회(최초 기록·최신으로 이동·아래 페이지·따라잡기)는 마지막에 시작한 하나만 반영한다.
   * 조회 중 받은 실시간 메시지는 모았다가, 조회 결과를 반영한 뒤 같은 커서 규칙으로 처리한다.
   */
  const tailSyncTokenRef = useRef(0);
  const liveBufferRef = useRef<ServerChatMessage[] | null>(null);
  const pendingCatchUpRef = useRef<CatchUpReason | null>(null);
  const requestCatchUpRef = useRef<(rid: string, reason: CatchUpReason) => void>(
    () => {},
  );
  const isFetchingOlderRef = useRef(false);
  const isFetchingNewerRef = useRef(false);
  const rawMessagesRef = useRef<ServerChatMessage[]>([]);

  const roomLifetimeRef = useRef(0);
  useLayoutEffect(() => {
    roomLifetimeRef.current += 1;
    isFetchingOlderRef.current = false;
    isFetchingNewerRef.current = false;
    liveBufferRef.current = null;
    pendingCatchUpRef.current = null;
    return () => { roomLifetimeRef.current += 1; };
  }, [roomId, userId]);

  useLayoutEffect(() => {
    rawMessagesRef.current = rawMessages;
    activeRoomIdRef.current = roomId?.trim() ?? "";
    fetchHistoryRef.current = fetchHistory;
  }, [rawMessages, roomId, fetchHistory]);

  const { markMessagesRead, resetReadDedup, onIncomingMessage } =
    useChatMessageRead({
      roomId,
      panelOpen: fetchHistory,
      rawMessagesRef,
    });

  const memberMap = useMemo(() => {
    const members = membersData?.members;
    if (!members?.length) {
      return new Map<
        number,
        Pick<RoomMember, "nickname" | "profileImageUrl">
      >();
    }
    return new Map(
      members.map((m) => {
        const uid = parseFiniteNumber(m.userId) ?? m.userId;
        return [
          uid,
          { nickname: m.nickname, profileImageUrl: m.profileImageUrl },
        ] as const;
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
      rawMessages.map((m) =>
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
    ],
  );

  const publishScrollToAnchor = useCallback(
    (lastReadMessageId: string | null | undefined) => {
      reopenScrollKeyRef.current += 1;
      setScrollToAnchor({
        anchorId: lastReadMessageId ?? undefined,
        key: reopenScrollKeyRef.current,
      });
    },
    [],
  );

  const applySessionReadBoundary = useCallback(
    (
      rid: string,
      lastReadMessageId: string | null,
      placement: ReadDividerPlacement,
    ) => {
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
    (
      slice: readonly ServerChatMessage[],
      placement: ReadDividerPlacement,
    ) =>
      (placement.beforeFirst && slice.length > 0) ||
      (placement.afterMessageId != null &&
        slice.some((message) => message.id === placement.afterMessageId)),
    [],
  );

  const restoreSessionReadBoundary = useCallback(
    (targetRoomId: string) => {
      const rid = targetRoomId.trim();
      if (!rid) return;

      const version = ++readBoundaryRestoreVersionRef.current;
      const isCurrentRequest = () =>
        readBoundaryRestoreVersionRef.current === version &&
        fetchHistoryRef.current &&
        activeRoomIdRef.current === rid;

      return getRoomMessageReadStatus(targetRoomId).then(async ({ lastReadMessageId }) => {
        if (!isCurrentRequest()) return;

        if (!lastReadMessageId) {
          applySessionReadBoundary(
            rid,
            null,
            EMPTY_READ_DIVIDER_PLACEMENT,
          );
          return;
        }

        const beforeSlice = [...rawMessagesRef.current];
        const bridged = await mergeSliceWithReadBridge(
          targetRoomId,
          lastReadMessageId,
          beforeSlice,
          beforeSlice,
        );
        if (!isCurrentRequest()) return;

        const bridgedSlice = bridged.bridgedSlice;
        const bridgedHasMoreNewer = bridged.bridgedHasMoreNewer;
        if (bridgedSlice && bridgedHasMoreNewer != null) {
          hasMoreNewerByRoomRef.current.set(rid, bridgedHasMoreNewer);
          setHasMoreNewer(bridgedHasMoreNewer);
          // 그사이 붙은 실시간 메시지를 지우지 않게 현재 목록에 합친다
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
      }).catch(() => {
        if (!isCurrentRequest()) return;
        const fallbackLastRead = lastReadMarkerByRoomRef.current.get(rid);
        const fallbackPlacement =
          readDividerPlacementByRoomRef.current.get(rid);
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
    [
      applySessionReadBoundary,
      canRenderReadDivider,
      publishScrollToAnchor,
      queryClient,
    ],
  );

  /** 목록 끝을 바꾸는 조회를 시작한다. 돌려받은 함수가 거짓이면 그 결과는 버린다 */
  const beginTailSync = useCallback(() => {
    tailSyncTokenRef.current += 1;
    liveBufferRef.current ??= [];
    const token = tailSyncTokenRef.current;
    const lifetime = roomLifetimeRef.current;
    return () =>
      tailSyncTokenRef.current === token &&
      roomLifetimeRef.current === lifetime;
  }, []);

  const applyLiveMessages = useCallback(
    (rid: string, msgs: readonly ServerChatMessage[], catchUpOnGap: boolean) => {
      // 첫 기록을 받기 전에는 그 조회가 이 메시지까지 가져온다
      if (
        msgs.length === 0 ||
        !historyFetchedRoomIdsRef.current.has(chatHistoryGateKey(userId, rid))
      ) {
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
          return appended.length > 0
            ? mergeServerMessageLists(updated, appended)
            : updated;
        });
      }
      if (hasGap && catchUpOnGap) requestCatchUpRef.current(rid, "gap");

      const newest = appended[appended.length - 1];
      if (newest) onIncomingMessage(newest, true);
    },
    [userId, onIncomingMessage],
  );

  /** 조회 결과를 반영한 뒤 모아 둔 실시간 메시지를 처리하고, 미뤄 둔 따라잡기를 잇는다 */
  const finishTailSync = useCallback(
    (rid: string, succeeded: boolean) => {
      const buffered = liveBufferRef.current ?? [];
      liveBufferRef.current = null;
      // 조회가 실패했으면 빈 번호를 바로 다시 요청하지 않는다 — 다음 수신·재연결이 다시 맞춘다
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
      // 끊긴 동안 온 메시지는 읽지 않은 메시지로 보여 준다
      if (!newestBefore || !fetchHistoryRef.current) return;
      applySessionReadBoundary(rid, newestBefore.id, {
        afterMessageId: newestBefore.id,
        beforeFirst: false,
      });
      publishScrollToAnchor(newestBefore.id);
    },
    [
      restoreSessionReadBoundary,
      onIncomingMessage,
      applySessionReadBoundary,
      publishScrollToAnchor,
    ],
  );

  const requestCatchUp = useCallback(
    (rid: string, reason: CatchUpReason) => {
      if (liveBufferRef.current) {
        // 목록 끝을 바꾸는 다른 조회가 진행 중이다 — 끝난 뒤(finishTailSync) 이어서 따라잡는다
        const pending = pendingCatchUpRef.current;
        if (
          !pending ||
          CATCH_UP_REASON_PRIORITY[reason] > CATCH_UP_REASON_PRIORITY[pending]
        ) {
          pendingCatchUpRef.current = reason;
        }
        return;
      }
      if (!historyFetchedRoomIdsRef.current.has(chatHistoryGateKey(userId, rid))) {
        return;
      }
      if (hasMoreNewerByRoomRef.current.get(rid) === true) {
        // 중간 창은 아래 페이지 조회가 최신 끝까지 맞춘다
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
            // 빈 방에서 최신 페이지를 받았다 — 그 앞 기록은 위로 스크롤해 받는다
            const more = hasOlderHistoryPage(rows.length, CHAT_MESSAGE_PAGE_SIZE);
            hasMoreByRoomRef.current.set(rid, more);
            setHasMore(more);
          }
          void warmPlacePhotoQueriesFromChatHistory(queryClient, rows);
          // 모아 둔 실시간 메시지가 더 새것이다 — 읽음 위치가 뒤로 가지 않게 따라잡은 메시지를 먼저 처리한다
          showCaughtUpMessages(rid, reason, appended, newestBefore);
          finishTailSync(rid, true);
        })
        .catch(() => {
          // 재시도 뒤에도 실패하면 커서를 그대로 둔다 — 다음 빈 번호 수신·재연결 때 같은 커서로 다시 받는다
          if (!isCurrent()) return;
          finishTailSync(rid, false);
          if (reason === "reopen") void restoreSessionReadBoundary(rid);
        });
    },
    [
      userId,
      queryClient,
      beginTailSync,
      finishTailSync,
      showCaughtUpMessages,
      restoreSessionReadBoundary,
    ],
  );

  useLayoutEffect(() => {
    requestCatchUpRef.current = requestCatchUp;
  }, [requestCatchUp]);

  const startHistoryLoad = useCallback(
    (targetRoomId: string) => {
      const rid = targetRoomId.trim();
      const isCurrent = beginTailSync();
      void retryChatHistoryRequest(
        () => loadRoomHistorySnapshot(targetRoomId),
        isCurrent,
      )
        .then((out) => {
          if (!isCurrent()) return;
          hasMoreByRoomRef.current.set(rid, out.hasMoreOlder);
          hasMoreNewerByRoomRef.current.set(rid, out.hasMoreNewer);
          setHasMore(out.hasMoreOlder);
          setHasMoreNewer(out.hasMoreNewer);

          const placement = out.lastReadMessageId
            ? resolveReadDividerPlacement(
                out.slice,
                out.lastReadMessageId,
                out.placementBeforeSlice,
                out.hasMoreNewer,
              )
            : EMPTY_READ_DIVIDER_PLACEMENT;
          applySessionReadBoundary(rid, out.lastReadMessageId, placement);

          setRawMessages(out.slice);
          // 최신 끝까지 받았으면 그 마지막 번호 다음부터 실시간 메시지를 붙인다
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

          if (
            out.lastReadMessageId &&
            canRenderReadDivider(out.slice, placement)
          ) {
            publishScrollToAnchor(out.lastReadMessageId);
          }
          finishTailSync(rid, true);
        })
        .catch(() => {
          // gate를 세우지 않는다 — 재연결되거나 패널을 다시 열 때 다시 받는다
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
      // 다른 방에 있던 동안은 이 방 메시지를 구독하지 않았다 — 다시 구독(부모 effect)을 보낸 뒤 따라잡는다
      queueMicrotask(() => {
        if (activeRoomIdRef.current === rid) requestCatchUp(rid, "reopen");
      });
      return;
    }
    // 진행 중인 최초 조회가 있으면 그 결과를 쓴다
    if (!liveBufferRef.current) startHistoryLoad(roomId);
  }, [roomId, fetchHistory, userId, requestCatchUp, startHistoryLoad]);

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = connected;
    if (!connected || wasConnected || !roomId || userId == null) return;

    const rid = roomId.trim();
    // 다시 구독한 토픽은 끊긴 동안의 메시지를 주지 않는다 — 구독(부모 effect)을 보낸 뒤 따라잡는다
    queueMicrotask(() => {
      if (activeRoomIdRef.current !== rid) return;
      if (
        liveBufferRef.current ||
        historyFetchedRoomIdsRef.current.has(chatHistoryGateKey(userId, rid))
      ) {
        requestCatchUp(rid, "reconnect");
      } else if (fetchHistoryRef.current) {
        // 끊긴 동안 최초 기록 조회가 끝내 실패했다 — 연결이 돌아온 지금 다시 받는다
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
        const more = hasOlderHistoryPage(
          normalizedHistory.length,
          CHAT_MESSAGE_PAGE_SIZE,
        );
        hasMoreByRoomRef.current.set(rid, more);
        setHasMore(more);
        setRawMessages((prev) =>
          mergeServerMessageLists(normalizedHistory, prev),
        );
        void warmPlacePhotoQueriesFromChatHistory(
          queryClient,
          normalizedHistory,
        );
      })
      .catch(() => {
        /* 유지: hasMore 그대로, 다음 스크롤에서 재시도 가능 */
      })
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
        const more = hasOlderHistoryPage(
          normalizedHistory.length,
          CHAT_MESSAGE_PAGE_SIZE,
        );
        hasMoreNewerByRoomRef.current.set(rid, more);
        setHasMoreNewer(more);
        setRawMessages((prev) =>
          mergeServerMessageLists(prev, normalizedHistory),
        );
        if (!more) {
          // 최신 끝에 닿았다 — 이 페이지의 마지막 번호 다음부터 실시간 메시지를 붙인다
          const last = maxSequenceInMessages([
            ...rawMessagesRef.current,
            ...normalizedHistory,
          ]);
          if (last == null) cursorByRoomRef.current.delete(rid);
          else cursorByRoomRef.current.set(rid, last);
        }
        void warmPlacePhotoQueriesFromChatHistory(
          queryClient,
          normalizedHistory,
        );
        finishTailSync(rid, true);
      })
      .catch(() => {
        // 유지: hasMoreNewer 그대로, 다음 스크롤에서 다시 받는다
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
        const more = hasOlderHistoryPage(
          normalized.length,
          CHAT_MESSAGE_PAGE_SIZE,
        );
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
        // 중간 창을 그대로 둔다 — 버튼을 다시 누르면 다시 받는다
        if (isCurrent()) finishTailSync(rid, false);
      });
  }, [
    roomId,
    queryClient,
    beginTailSync,
    finishTailSync,
    clearSessionReadBoundary,
    publishScrollToAnchor,
  ]);

  useEffect(() => {
    if (!roomId) {
      setRoomChatMessageHandler(null);
      return;
    }

    const rid = roomId.trim();
    const handler = (msg: ServerChatMessage) => {
      if (activeRoomIdRef.current !== rid) return;
      if (liveBufferRef.current) {
        liveBufferRef.current.push(msg);
        return;
      }
      applyLiveMessages(rid, [msg], true);
    };
    setRoomChatMessageHandler(handler);
    return () => setRoomChatMessageHandler(null);
  }, [roomId, setRoomChatMessageHandler, applyLiveMessages]);

  const rid = roomId?.trim() ?? "";
  const effectiveReadMarkerMessageId =
    fetchHistory && rid ? readMarkerMessageId : null;
  const effectiveReadDividerPlacement: ReadDividerPlacement | null =
    fetchHistory && rid
      ? readDividerPlacement.afterMessageId != null ||
        readDividerPlacement.beforeFirst
        ? readDividerPlacement
        : null
      : null;

  return {
    messages,
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
