import type { Query } from "@tanstack/react-query";

import { isBatchItemOk } from "@/lib/api/batch-types";
import { HttpError } from "@/lib/api/errors";
import {
  requestPlacePhotoUrl,
  requestPlacePhotoUrlsBatch,
  type PlacePhotoUrlBatchItem,
} from "@/lib/api/places";
import { normalizeGooglePlaceResourceId } from "@/lib/maps";
import {
  createPlaceBatchLoader,
  type PlaceBatchResult,
} from "@/lib/places/place-batch-loader";

const PLACE_PHOTO_QUERY_GC_MS = 7 * 24 * 60 * 60 * 1000;
const PLACE_PHOTO_EMPTY_STALE_MS = 5 * 60 * 1000;

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

function photoBatchItemResult(item: PlacePhotoUrlBatchItem): PlaceBatchResult<string> {
  if (isBatchItemOk(item)) {
    return {
      ok: true,
      value: typeof item.photoUrl === "string" ? item.photoUrl.trim() : "",
    };
  }
  return {
    ok: false,
    error: new HttpError(502, `장소 사진 URL 조회 실패: ${item.errorCode ?? item.status}`),
  };
}

function placeKey(googlePlaceId: unknown): string {
  return typeof googlePlaceId === "string"
    ? normalizeGooglePlaceResourceId(googlePlaceId.trim())
    : "";
}

export const loadPlacePhotoUrl = createPlaceBatchLoader<string>({
  fetchOne: (id) => requestPlacePhotoUrl(id),
  fetchMany: async (ids) => {
    const byPlace = new Map<string, PlaceBatchResult<string>>();
    for (const item of await requestPlacePhotoUrlsBatch(ids)) {
      byPlace.set(placeKey(item.googlePlaceId), photoBatchItemResult(item));
    }
    const results = new Map<string, PlaceBatchResult<string>>();
    for (const id of ids) {
      const result = byPlace.get(placeKey(id));
      if (result) results.set(id, result);
    }
    return results;
  },
});
