import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";

// ─── Bookmarks ───────────────────────────────────────────────────────────────

export const BOOKMARK_CATEGORIES_SEGMENT = "bookmark-categories" as const;
export const ROOM_BOOKMARKS_SEGMENT = "room-bookmarks" as const;
export const PLACE_CARD_BOOKMARK_SEGMENT = "place-card-bookmark" as const;

const BOOKMARK_CATEGORIES = BOOKMARK_CATEGORIES_SEGMENT;
const ROOM_BOOKMARKS = ROOM_BOOKMARKS_SEGMENT;
const PLACE_CARD_BOOKMARK = PLACE_CARD_BOOKMARK_SEGMENT;

export function bookmarkCategoriesQueryKey(roomId: string | null) {
  return [BOOKMARK_CATEGORIES, roomId] as const;
}

export function roomBookmarksQueryKey(
  roomId: string | null,
  categoryId: number | null,
) {
  return [ROOM_BOOKMARKS, roomId, categoryId] as const;
}

/** 해당 방의 모든 카테고리별 북마크 목록 쿼리에 공통 접두 */
export function roomBookmarksByRoomRootQueryKey(roomId: string) {
  return [ROOM_BOOKMARKS, roomId] as const;
}

export function roomAllBookmarksQueryKey(roomId: string | null) {
  return ["room-bookmarks-all", roomId] as const;
}

/** 해당 방 아래 장소 카드(place detail) 미리보기 쿼리 제거용 접두 */
export function placeCardBookmarkRootQueryKey(roomId: string) {
  return [PLACE_CARD_BOOKMARK, roomId] as const;
}

export function placeCardBookmarkQueryKey(
  roomId: string,
  googlePlaceId: string,
  bookmarkId: number,
) {
  return [PLACE_CARD_BOOKMARK, roomId, googlePlaceId, bookmarkId] as const;
}

// ─── Plan itinerary map path (per segment, Google Directions JS) ─────────────

const PLAN_ITINERARY_MAP_PATH_CACHE_VERSION = "orient-v1" as const;

export function planItinerarySegmentMapPathQueryKey(
  rid: string,
  scheduleId: number,
  segmentSourceItemId: number,
  originPlaceId: string,
  destPlaceId: string,
  travelModeCanon: string,
  roomDirectionsEpoch: number,
  segmentEpoch: number,
) {
  return [
    "plan-itinerary-map-segment-path",
    PLAN_ITINERARY_MAP_PATH_CACHE_VERSION,
    rid,
    scheduleId,
    segmentSourceItemId,
    originPlaceId.trim(),
    destPlaceId.trim(),
    travelModeCanon,
    roomDirectionsEpoch,
    segmentEpoch,
  ] as const;
}

// ─── Room schedules ──────────────────────────────────────────────────────────

export const roomSchedulesQueryKey = (roomId: string | null) =>
  ["room-schedules", roomId] as const;

// ─── Session / search map ────────────────────────────────────────────────────

export const sessionUserQueryKey = ["session", "user"] as const;

export type ActiveSearchMapPin = {
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
};

// ─── Rooms / members ─────────────────────────────────────────────────────────

export const ROOMS_QUERY_KEY = ["rooms"] as const;

export function roomDetailQueryKey(roomId: string) {
  return ["room-detail", roomId] as const;
}

export function roomMembersQueryKey(roomId: string | null) {
  return ["room-members", roomId] as const;
}

export function roomUnreadCountQueryKey(roomId: string | null) {
  return ["room-unread-count", roomId] as const;
}

export function joinRequestsQueryKey(roomId: string | null) {
  return ["join-requests", roomId] as const;
}

// ─── Schedule items / routes ─────────────────────────────────────────────────

export const scheduleItemsQueryKey = (
  roomId: string | null,
  scheduleId: number | null,
) => ["schedule-items", roomId, scheduleId, "v2-loc"] as const;

/**
 * 구간별 길찾기 API 결과 (`GET …/route?travelMode=…`).
 * 무효화: `["schedule-item-route", roomId]` prefix.
 */
export const scheduleItemRouteQueryKey = (
  roomId: string | null,
  scheduleId: number | null,
  segmentSourceItemId: number | null,
  travelMode: ScheduleTravelModeValue | null,
) =>
  [
    "schedule-item-route",
    roomId,
    scheduleId,
    segmentSourceItemId,
    travelMode,
  ] as const;

/** Private packing data is scoped to both the explicit room and session principal. */
export const packingQueryKey = (roomId: string, userId: number) =>
  ['packing', roomId, userId] as const;
