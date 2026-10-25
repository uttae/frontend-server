import type { Query } from "@tanstack/react-query";

import { requestPlacePhotoUrl } from "@/lib/api/places";
import { getQueryClient } from "@/lib/query-client";

/**
 * `usePlacePhotoUrlQuery` — 같은 `googlePlaceId`에 대해 불필요한 `GET /places/photos` 재호출 방지.
 */
export const PLACE_PHOTO_QUERY_GC_MS = 7 * 24 * 60 * 60 * 1000;
export const PLACE_PHOTO_EMPTY_STALE_MS = 5 * 60 * 1000;

export function placePhotoUrlQueryKey(googlePlaceId: string) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return ["places", "photoUrl", id] as const;
}

function placePhotoUrlStaleTime(
  query: Query<
    string,
    Error,
    string,
    ReturnType<typeof placePhotoUrlQueryKey>
  >,
): number {
  return typeof query.state.data === "string" &&
    query.state.data.trim().length === 0
    ? PLACE_PHOTO_EMPTY_STALE_MS
    : Infinity;
}

export const placePhotoUrlQueryDefaults = {
  staleTime: placePhotoUrlStaleTime,
  gcTime: PLACE_PHOTO_QUERY_GC_MS,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** batch 시딩 후 구독 — 항목별 실패로 캐시 miss이면 단건 GET fallback */
export function seededPlacePhotoUrlQueryOptions(
  googlePlaceId: string,
  options?: { enabled?: boolean },
) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  const enabled = (options?.enabled ?? true) && id.length > 0;
  return {
    queryKey: placePhotoUrlQueryKey(id),
    queryFn: (): string | Promise<string> => {
      const state = getQueryClient()?.getQueryState<string>(
        placePhotoUrlQueryKey(id),
      );
      const cached = state?.data;
      if (typeof cached === "string") {
        const trimmed = cached.trim();
        if (
          trimmed.length > 0 ||
          Date.now() - (state?.dataUpdatedAt ?? 0) < PLACE_PHOTO_EMPTY_STALE_MS
        ) {
          return trimmed;
        }
      }
      return requestPlacePhotoUrl(id);
    },
    enabled,
    ...placePhotoUrlQueryDefaults,
  };
}
