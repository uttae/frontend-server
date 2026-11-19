import type { ScheduleTravelModeValue } from "@/lib/plan/scheduleTravelMode";

export const BOOKMARK_CATEGORIES_SEGMENT = "bookmark-categories" as const;
export const PLACE_CARD_BOOKMARK_SEGMENT = "place-card-bookmark" as const;

const BOOKMARK_CATEGORIES = BOOKMARK_CATEGORIES_SEGMENT;
const PLACE_CARD_BOOKMARK = PLACE_CARD_BOOKMARK_SEGMENT;

export function bookmarkCategoriesQueryKey(roomId: string | null) {
  return [BOOKMARK_CATEGORIES, roomId] as const;
}

export function roomAllBookmarksQueryKey(roomId: string | null) {
  return ["room-bookmarks-all", roomId] as const;
}

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

const PLAN_ITINERARY_MAP_PATH_CACHE_VERSION = "orient-v1" as const;

export function planItinerarySegmentMapPathQueryKey(
  rid: string,
  scheduleId: number,
  segmentSourceItemId: number,
  destinationItemId: number,
  originPlaceId: string,
  destPlaceId: string,
  travelModeCanon: string,
) {
  return [
    "plan-itinerary-map-segment-path",
    PLAN_ITINERARY_MAP_PATH_CACHE_VERSION,
    rid,
    scheduleId,
    segmentSourceItemId,
    destinationItemId,
    originPlaceId.trim(),
    destPlaceId.trim(),
    travelModeCanon,
  ] as const;
}

export const roomSchedulesQueryKey = (roomId: string | null) =>
  ["room-schedules", roomId] as const;

export const sessionUserQueryKey = ["session", "user"] as const;

export type ActiveSearchMapPin = {
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
};

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

export function joinRequestsRootQueryKey() {
  return ["join-requests"] as const;
}

export const scheduleItemsQueryKey = (
  roomId: string | null,
  scheduleId: number | null,
) => ["schedule-items", roomId, scheduleId, "v2-loc"] as const;

export const scheduleItemRouteQueryKey = (
  roomId: string | null,
  scheduleId: number | null,
  segmentSourceItemId: number | null,
  destinationItemId: number | null,
  travelMode: ScheduleTravelModeValue | null,
) =>
  [
    "schedule-item-route",
    roomId,
    scheduleId,
    segmentSourceItemId,
    destinationItemId,
    travelMode,
  ] as const;

export const packingQueryKey = (roomId: string, userId: number) =>
  ['packing', roomId, userId] as const;
