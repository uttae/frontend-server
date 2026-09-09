import { invalidateExpenses, expenseKeys } from "@/lib/expenses/expense-queries";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useStompContext } from "@/contexts/StompContext";
import { toast } from "sonner";

import {
  HttpError,
  approveJoinRequest,
  createBookmarkCategory,
  createRoomBookmark,
  createRoomBookmarks,
  createRoom,
  createRoomSchedule,
  createScheduleItem,
  deleteScheduleItem,
  reorderScheduleItem,
  moveScheduleItemToSchedule,
  updateScheduleItem,
  updateScheduleItemTravelMode,
  deleteRoomBookmark,
  deleteBookmarkCategory,
  deleteRoom,
  deleteRoomSchedule,
  getBookmarkCategories,
  getJoinRequests,
  getJoinStatus,
  getRoomBookmarks,
  getRoomMembers,
  patchRoomBookmarkCategory,
  getRooms,
  joinRoom,
  kickMember,
  leaveRoom,
  moveRoomSchedule,
  regenerateInviteCode,
  rejectJoinRequest,
  type BookmarkCategory,
  type RoomBookmark,
  type RoomCreateRequest,
  type RoomScheduleCreateRequest,
  type ReorderScheduleItemRequest,
  type RoomScheduleItemUpdateRequest,
  type RoomUpdateRequest,
  transferHost,
  updateBookmarkCategory,
  updateRoom,
  type RoomDetail,
  type RoomListItem,
  type RoomListResponse,
  type RoomSchedule,
} from "@/lib/api/rooms";
import {
  applyRoomScheduleItemToPlanPlaces,
  applyScheduleItemDeletedOnClient,
  createScheduleItemAtPlanIndex,
  ensureSchedulePlanPlacesEnriched,
  syncAfterCrossScheduleItemMove,
  syncPlanPlacesAfterReorderSuccess,
} from "@/lib/plan/scheduleItemPlaces";
import { planPlacesNeedPreviewEnrich } from "@/lib/plan/schedule-bulk-hydration";
import { fetchAndSeedAllRoomBookmarks } from "@/lib/bookmarks/bookmark-bulk-cache";
import {
  appendBookmarkCategoryToCache,
  appendRoomBookmarksToCache,
} from "@/lib/bookmarks/bookmark-cache-patch";
import {
  bookmarkCategoriesQueryKey,
  joinRequestsQueryKey,
  roomAllBookmarksQueryKey,
  roomBookmarksByRoomRootQueryKey,
  roomBookmarksQueryKey,
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomMembersQueryKey,
  roomSchedulesQueryKey,
  scheduleItemsQueryKey,
} from "@/lib/query-keys";
import {
  hydrateRoomSchedulesFromServer,
  syncRoomDetailFromServer,
} from "@/lib/rooms";
import type { PlanPlace } from "@/lib/plan/types";
import {
  pathDefersRoomStompRoomTopics,
  pathSuspendsStomp,
} from "@/lib/stomp/stompPathPolicy";
import { persistedScheduleItemRouteQueryOptions } from "@/lib/plan/scheduleItemRoutePersistedQuery";
import { invalidateScheduleItemRouteForWholeSchedule } from "@/lib/plan/scheduleStompRouteScope";
import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";
import { usePlanMapDirectionsEpochStore } from "@/stores/plan-map-directions-epoch-store";
import { useSessionUser } from "@/hooks/useSessionUser";

export function useRoomsList() {
  return useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: () => getRooms(),
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RoomCreateRequest) => createRoom(data),
    onSuccess: async (room) => {
      const rid = room.id.trim();
      if (rid.length) {
        queryClient.setQueryData<RoomDetail>(roomDetailQueryKey(rid), {
          id: room.id,
          title: room.title,
          destinations: room.destinations,
          startDate: room.startDate,
          endDate: room.endDate,
          inviteCode: room.inviteCode,
          memberCount: room.memberCount,
          role: room.role,
          createdAt: room.createdAt,
        });
        const listItem: RoomListItem = {
          id: room.id,
          title: room.title,
          destinations: room.destinations,
          startDate: room.startDate,
          endDate: room.endDate,
          role: room.role,
          joinedAt: room.createdAt,
        };
        queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
          if (!prev) {
            return {
              rooms: [listItem],
              nextCursor: null,
              hasNext: false,
            };
          }
          if (prev.rooms.some((r) => r.id === rid)) {
            return {
              ...prev,
              rooms: prev.rooms.map((r) =>
                r.id === rid ? { ...r, ...listItem } : r,
              ),
            };
          }
          return { ...prev, rooms: [listItem, ...prev.rooms] };
        });
      }
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
      await hydrateRoomSchedulesFromServer(queryClient, room.id);
      await syncRoomDetailFromServer(queryClient, room.id);
    },
  });
}

export function useRoomSchedules(roomId: string | null) {
  const id = roomId?.trim() ?? "";
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: roomSchedulesQueryKey(id || null),
    queryFn: () => hydrateRoomSchedulesFromServer(queryClient, id),
    enabled: id.length > 0,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useScheduleItemRoute(
  roomId: string | null,
  scheduleId: number | null,
  segmentSourceItemId: number | null,
  travelMode: ScheduleTravelModeValue,
  /** 일정 장소 목록상 구간 소스 아이디가 존재·목록 안정 후에만 true */
  routeQueryEnabled = true,
  /** 빈 문자열이면 LS 미사용 — `scheduleFingerprint` 지문 필요 */
  scheduleFingerprint = "",
) {
  const rid = roomId?.trim() ?? "";

  return useQuery({
    ...persistedScheduleItemRouteQueryOptions(
      rid,
      scheduleId,
      segmentSourceItemId,
      travelMode,
      scheduleFingerprint,
      { segmentReady: Boolean(routeQueryEnabled) },
    ),
  });
}

export function useDeleteRoomSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      scheduleId,
    }: {
      roomId: string;
      scheduleId: number;
    }) => deleteRoomSchedule(roomId, scheduleId),
    onSuccess: async (_data, { roomId, scheduleId }) => {
      await invalidateExpenses(queryClient, roomId);
      const id = roomId.trim();
      if (!id.length) return;

      const sorted = await hydrateRoomSchedulesFromServer(queryClient, id);
      const scheduleStillExists = sorted.some((s) => s.scheduleId === scheduleId);
      if (scheduleStillExists) {
        await invalidateScheduleItemRouteForWholeSchedule(
          queryClient,
          id,
          scheduleId,
        );
        usePlanMapDirectionsEpochStore.getState().bumpForDirections(id);
      }

      await syncRoomDetailFromServer(queryClient, id);
    },
  });
}

/**
 * 일차(schedule) 생성 — 액터는 POST `onSuccess`, 원격은 STOMP `ROOM_SCHEDULES_RESYNCED`로 갱신합니다.
 */
export function useCreateRoomSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      body,
    }: {
      roomId: string;
      body: RoomScheduleCreateRequest;
    }) => createRoomSchedule(roomId, body),
    onSuccess: async (_created, { roomId }) => {
      const id = roomId.trim();
      if (!id.length) return;
      await hydrateRoomSchedulesFromServer(queryClient, id);
      await syncRoomDetailFromServer(queryClient, id);
    },
  });
}

/** 일차(schedule) 이동 — shift 후 전체 재조회로 갱신 (원격: STOMP `ROOM_SCHEDULES_RESYNCED`) */
export function useMoveRoomSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      scheduleId,
      targetDayNumber,
    }: {
      roomId: string;
      scheduleId: number;
      targetDayNumber: number;
    }) => moveRoomSchedule(roomId, scheduleId, { targetDayNumber }),
    onSuccess: async (_data, { roomId }) => {
      const id = roomId.trim();
      if (!id.length) return;
      await invalidateExpenses(queryClient, id);
      await hydrateRoomSchedulesFromServer(queryClient, id);
    },
  });
}

/** 일정 항목을 다른 일차로 이동 — 같은 일차 내 순서는 `useReorderScheduleItem` 사용 */
export function useMoveScheduleItemToSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      sourceScheduleId,
      itemId,
      targetScheduleId,
      targetOrderIndex,
    }: {
      roomId: string;
      sourceScheduleId: number;
      itemId: number;
      targetScheduleId: number;
      targetOrderIndex: number;
    }) => {
      if (sourceScheduleId === targetScheduleId) {
        throw new Error("같은 일차 안에서는 순서 변경만 가능해요.");
      }
      return moveScheduleItemToSchedule(roomId, sourceScheduleId, itemId, {
        targetScheduleId,
        targetOrderIndex,
      });
    },
    onSuccess: async (
      _moved,
      { roomId, sourceScheduleId, targetScheduleId, itemId },
    ) => {
      await invalidateExpenses(queryClient, roomId);
      await syncAfterCrossScheduleItemMove(
        queryClient,
        roomId,
        sourceScheduleId,
        targetScheduleId,
        itemId,
      );
    },
  });
}

export function useSchedulePlanPlaces(
  roomId: string | null,
  scheduleId: number | null,
) {
  const rid = roomId?.trim() ?? "";
  const sid = scheduleId;
  const queryClient = useQueryClient();
  const { isSuccess: schedulesHydrated } = useRoomSchedules(rid || null);

  return useQuery({
    queryKey: scheduleItemsQueryKey(rid || null, sid),
    queryFn: () => ensureSchedulePlanPlacesEnriched(queryClient, rid, sid!),
    enabled:
      rid.length > 0 &&
      typeof sid === "number" &&
      Number.isFinite(sid) &&
      schedulesHydrated,
    staleTime: Infinity,
    refetchOnMount: (query) => {
      const data = query.state.data;
      return !Array.isArray(data) || planPlacesNeedPreviewEnrich(data);
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreateScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      roomId: string;
      scheduleId: number;
      googlePlaceId: string;
      insertIndex?: number;
      placesSnapshot?: PlanPlace[];
    }) => {
      const places = vars.placesSnapshot ?? [];
      const insertIndex = vars.insertIndex ?? places.length;

      return createScheduleItemAtPlanIndex(queryClient, {
        roomId: vars.roomId,
        scheduleId: vars.scheduleId,
        places,
        insertIndex,
        googlePlaceId: vars.googlePlaceId,
      });
    },
  });
}

export function useUpdateScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
      body: RoomScheduleItemUpdateRequest;
    }) =>
      updateScheduleItem(
        vars.roomId,
        vars.scheduleId,
        vars.itemId,
        vars.body,
      ),
    onSuccess: (updated, { roomId, scheduleId, body }) => {
      const rid = roomId.trim();
      if (!rid.length) return;
      const key = scheduleItemsQueryKey(rid, scheduleId);
      const prev = queryClient.getQueryData<PlanPlace[]>(key);
      const merged = applyRoomScheduleItemToPlanPlaces(prev, updated, {
        memoTouched: Object.prototype.hasOwnProperty.call(body, "memo"),
      });
      if (merged) {
        queryClient.setQueryData(key, merged);
      } else {
        void queryClient.invalidateQueries({
          queryKey: key,
          refetchType: "active",
        });
      }
    },
  });
}

/**
 * 구간 공유 이동수단 변경 — 서버 DB 저장 후 `SCHEDULE_ITEM_TRAVEL_MODE_UPDATED`가
 * 브로드캐스트되며, 액터는 응답으로 `schedule-items` 캐시만 갱신합니다.
 * 수단별 경로 캐시는 모드 키로 분리돼 있어 무효화가 필요 없습니다.
 */
export function useUpdateScheduleItemTravelMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
      travelMode: ScheduleTravelModeValue;
    }) =>
      updateScheduleItemTravelMode(
        vars.roomId,
        vars.scheduleId,
        vars.itemId,
        { travelMode: vars.travelMode },
      ),
    onSuccess: (updated, { roomId, scheduleId }) => {
      const rid = roomId.trim();
      if (!rid.length) return;
      const key = scheduleItemsQueryKey(rid, scheduleId);
      const prev = queryClient.getQueryData<PlanPlace[]>(key);
      const merged = applyRoomScheduleItemToPlanPlaces(prev, updated);
      if (merged) {
        queryClient.setQueryData(key, merged);
      } else {
        void queryClient.invalidateQueries({
          queryKey: key,
          refetchType: "active",
        });
      }
    },
  });
}

export function useDeleteScheduleItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
    }) => deleteScheduleItem(vars.roomId, vars.scheduleId, vars.itemId),
    onSuccess: async (_, { roomId, scheduleId, itemId }) => {
      await invalidateExpenses(queryClient, roomId);
      await applyScheduleItemDeletedOnClient(
        queryClient,
        roomId,
        scheduleId,
        itemId,
      );
    },
  });
}

export function useReorderScheduleItem() {
  const queryClient = useQueryClient();
  const [isChainedTimeSyncPending, setIsChainedTimeSyncPending] =
    useState(false);
  const mutation = useMutation({
    mutationFn: (vars: {
      roomId: string;
      scheduleId: number;
      itemId: number;
      body: ReorderScheduleItemRequest;
    }) =>
      reorderScheduleItem(
        vars.roomId,
        vars.scheduleId,
        vars.itemId,
        vars.body,
      ),
    onMutate: () => {
      setIsChainedTimeSyncPending(true);
    },
    onError: () => {
      setIsChainedTimeSyncPending(false);
    },
    onSuccess: async (items, { roomId, scheduleId, itemId }) => {
      try {
        await syncPlanPlacesAfterReorderSuccess(
          queryClient,
          roomId,
          scheduleId,
          items,
          itemId,
        );
      } finally {
        setIsChainedTimeSyncPending(false);
      }
    },
  });

  return {
    ...mutation,
    /** 리오더 요청 + 시작 시각 연쇄 PATCH까지(캐시가 일관될 때까지) */
    isReorderSettling:
      mutation.isPending || isChainedTimeSyncPending,
  };
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      data,
    }: {
      roomId: string;
      data: RoomUpdateRequest;
      previousStartDate?: string | null;
      previousEndDate?: string | null;
    }) => updateRoom(roomId, data),
    onSuccess: async (
      updated,
      { roomId, data, previousStartDate, previousEndDate },
    ) => {
      queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rooms: prev.rooms.map((r) =>
            r.id === roomId ?
              {
                ...r,
                title: updated.title,
                destinations: updated.destinations,
                startDate: updated.startDate ?? null,
                endDate: updated.endDate ?? null,
              }
            : r,
          ),
        };
      });
      queryClient.setQueryData<RoomDetail>(
        roomDetailQueryKey(roomId),
        (prev) =>
          prev && prev.id === roomId ?
            {
              ...prev,
              title: updated.title,
              destinations: updated.destinations,
              startDate: updated.startDate ?? null,
              endDate: updated.endDate ?? null,
            }
          : prev,
      );

      const prevStart = previousStartDate?.trim() ?? "";
      const prevEnd = previousEndDate?.trim() ?? "";
      const datesChanged =
        (data.startDate !== undefined && data.startDate !== prevStart) ||
        (data.endDate !== undefined && data.endDate !== prevEnd);

      if (datesChanged) {
        await invalidateExpenses(queryClient, roomId);
        await hydrateRoomSchedulesFromServer(queryClient, roomId);
      }
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => deleteRoom(roomId),
    onSuccess: (_, roomId) => {
      queryClient.removeQueries({ queryKey: expenseKeys.room(roomId) });
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useRegenerateInviteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roomId: string) => regenerateInviteCode(roomId),
    onSuccess: (data, roomId) => {
      queryClient.setQueryData<RoomDetail>(
        roomDetailQueryKey(roomId),
        (prev) => (prev ? { ...prev, inviteCode: data.inviteCode } : prev),
      );
    },
  });
}

export function useRoomMembers(roomId: string | null) {
  const pathname = usePathname();
  const { data: user } = useSessionUser();
  const { connected: stompConnected } = useStompContext();

  /**
   * 방 토픽을 구독하는 구간에서는 STOMP 연결·`/app/ping` 이전에 GET /members 가 먼저 나가면
   * `isOnline` 이 모두 false 로 내려오는 경우가 있다. STOMP 연결 후에만 조회한다.
   * `/home` 등 방 토픽을 미루는 경로는 즉시 조회(ping은 연결 단위로 계속 전송).
   */
  const waitForStompBeforeMembers =
    Boolean(user && roomId) &&
    !pathSuspendsStomp(pathname) &&
    !pathDefersRoomStompRoomTopics(pathname);

  return useQuery({
    queryKey: roomMembersQueryKey(roomId),
    queryFn: () => getRoomMembers(roomId!),
    enabled: !!roomId && (!waitForStompBeforeMembers || stompConnected),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useJoinRoom() {
  return useMutation({
    mutationFn: (inviteCode: string) => joinRoom(inviteCode),
  });
}

export function useCheckJoinStatus() {
  return useMutation({
    mutationFn: (roomId: string) => getJoinStatus(roomId),
  });
}

export function useJoinRequests(
  roomId: string | null,
  options?: { enabled?: boolean },
) {
  const userEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: joinRequestsQueryKey(roomId),
    queryFn: () => getJoinRequests(roomId!),
    enabled: !!roomId && userEnabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useTransferHost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      targetUserId,
    }: {
      roomId: string;
      targetUserId: number;
    }) => transferHost(roomId, targetUserId),
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: roomMembersQueryKey(roomId) });
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useLeaveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => leaveRoom(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useKickMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, userId }: { roomId: string; userId: number }) =>
      kickMember(roomId, userId),
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: roomMembersQueryKey(roomId) });
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useApproveJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      requestId,
    }: {
      roomId: string;
      requestId: number;
    }) => approveJoinRequest(roomId, requestId),
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: joinRequestsQueryKey(roomId) });
      queryClient.invalidateQueries({ queryKey: roomMembersQueryKey(roomId) });
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
    },
  });
}

export function useRejectJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      requestId,
    }: {
      roomId: string;
      requestId: number;
    }) => rejectJoinRequest(roomId, requestId),
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: joinRequestsQueryKey(roomId) });
    },
  });
}

export function useBookmarkCategories(
  roomId: string | null,
  options?: { enabled?: boolean },
) {
  const queryEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: bookmarkCategoriesQueryKey(roomId),
    queryFn: () => getBookmarkCategories(roomId!),
    enabled: !!roomId && queryEnabled,
    staleTime: 0,
  });
}

export function useCreateBookmarkCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      name,
      colorCode,
    }: {
      roomId: string;
      name: string;
      colorCode: string;
    }) => createBookmarkCategory(roomId, { name, colorCode }),
    onSuccess: (created, { roomId }) => {
      appendBookmarkCategoryToCache(queryClient, roomId, created);
    },
  });
}

export function useUpdateBookmarkCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      categoryId,
      name,
      colorCode,
    }: {
      roomId: string;
      categoryId: number;
      name: string;
      colorCode: string;
    }) => updateBookmarkCategory(roomId, categoryId, { name, colorCode }),
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(roomId),
      });
    },
  });
}

export function useDeleteBookmarkCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      categoryId,
    }: {
      roomId: string;
      categoryId: number;
    }) => deleteBookmarkCategory(roomId, categoryId),
    onSuccess: (_, { roomId }) => {
      queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(roomId),
      });
    },
  });
}

export function useAllRoomBookmarks(
  roomId: string | null,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const queryEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: roomAllBookmarksQueryKey(roomId),
    queryFn: () => fetchAndSeedAllRoomBookmarks(queryClient, roomId!),
    enabled: !!roomId && queryEnabled,
    staleTime: Infinity,
    // STOMP가 비활성 캐시를 stale로 표시했다면 queryFn이 등록된 뒤 갱신한다.
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useRoomBookmarks(
  roomId: string | null,
  categoryId: number | null,
) {
  const idOk =
    categoryId != null && Number.isFinite(categoryId) && categoryId >= 0;
  return useQuery({
    queryKey: roomBookmarksQueryKey(roomId, idOk ? categoryId : null),
    queryFn: () => getRoomBookmarks(roomId!, categoryId!),
    enabled: !!roomId && idOk,
    staleTime: Infinity,
    // setQueryData로 시딩된 비활성 캐시는 마운트 시점에만 안전하게 재조회한다.
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useCreateRoomBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      googlePlaceId,
      categoryId,
    }: {
      roomId: string;
      googlePlaceId: string;
      categoryId: number;
    }) => createRoomBookmark(roomId, { googlePlaceId, categoryId }),
    onSuccess: (created, { roomId, categoryId }) => {
      queryClient.setQueryData<BookmarkCategory[]>(
        bookmarkCategoriesQueryKey(roomId),
        (prev) => {
          if (!prev?.length) return prev;
          return prev.map((c) =>
            c.categoryId === categoryId
              ? { ...c, placeCount: c.placeCount + 1 }
              : c,
          );
        },
      );
      appendRoomBookmarksToCache(queryClient, roomId, [created]);
    },
  });
}

export type CreateRoomBookmarksInCategoriesResult = {
  added: number;
  skippedDuplicate: number;
  /** Stopped early; categories after this were not attempted. */
  firstHardError: Error | null;
  /** Categories that received a successful POST (for local cache only). */
  addedCategoryIds: number[];
  bookmarks: RoomBookmark[];
};

/** POST 한 번으로 `googlePlaceId` + `categoryIds` 배열 전달. STOMP와 함께 목록 캐시도 즉시 무효화합니다. */
export function useCreateRoomBookmarksInCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roomId,
      googlePlaceId,
      categoryIds,
    }: {
      roomId: string;
      googlePlaceId: string;
      categoryIds: number[];
    }): Promise<CreateRoomBookmarksInCategoriesResult> => {
      try {
        const bookmarks = await createRoomBookmarks(roomId, {
          googlePlaceId,
          categoryIds,
        });
        const addedCategoryIds = bookmarks.map((b) => b.categoryId);
        const added = bookmarks.length;
        const skippedDuplicate = Math.max(0, categoryIds.length - added);
        return {
          added,
          skippedDuplicate,
          firstHardError: null,
          addedCategoryIds,
          bookmarks,
        };
      } catch (e) {
        if (e instanceof HttpError && e.status === 409) {
          return {
            added: 0,
            skippedDuplicate: categoryIds.length,
            firstHardError: null,
            addedCategoryIds: [],
            bookmarks: [],
          };
        }
        return {
          added: 0,
          skippedDuplicate: 0,
          firstHardError: e instanceof Error ? e : new Error(String(e)),
          addedCategoryIds: [],
          bookmarks: [],
        };
      }
    },
    onSuccess: (result, { roomId }) => {
      if (!result.addedCategoryIds.length) return;
      queryClient.setQueryData<BookmarkCategory[]>(
        bookmarkCategoriesQueryKey(roomId),
        (prev) => {
          if (!prev?.length) return prev;
          const bumped = new Set(result.addedCategoryIds);
          return prev.map((c) =>
            bumped.has(c.categoryId)
              ? { ...c, placeCount: c.placeCount + 1 }
              : c,
          );
        },
      );
      appendRoomBookmarksToCache(queryClient, roomId, result.bookmarks);
    },
  });
}

export function useMoveRoomBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roomId,
      bookmarkId,
      categoryId,
    }: {
      roomId: string;
      bookmarkId: number;
      categoryId: number;
      fromCategoryId: number;
    }) => patchRoomBookmarkCategory(roomId, bookmarkId, { categoryId }),
    onSuccess: (_, { roomId, categoryId, fromCategoryId }) => {
      queryClient.invalidateQueries({
        queryKey: roomBookmarksQueryKey(roomId, fromCategoryId),
      });
      queryClient.invalidateQueries({
        queryKey: roomBookmarksQueryKey(roomId, categoryId),
      });
      queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(roomId),
      });
      queryClient.invalidateQueries({
        queryKey: roomAllBookmarksQueryKey(roomId),
      });
    },
  });
}

export function useDeleteRoomBookmarkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      roomId: string;
      bookmarkId: number;
      categoryId: number;
    }) => deleteRoomBookmark(input.roomId, input.bookmarkId),
    onSuccess: (_, { roomId, categoryId }) => {
      queryClient.invalidateQueries({
        queryKey: roomBookmarksQueryKey(roomId, categoryId),
      });
      queryClient.invalidateQueries({
        queryKey: bookmarkCategoriesQueryKey(roomId),
      });
      queryClient.invalidateQueries({
        queryKey: roomAllBookmarksQueryKey(roomId),
      });
    },
  });
}
