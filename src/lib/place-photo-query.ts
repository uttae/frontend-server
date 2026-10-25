import type { Query } from "@tanstack/react-query";

import { isBatchItemOk } from "@/lib/api/batch-types";
import { HttpError } from "@/lib/api/errors";
import {
  requestPlacePhotoUrl,
  requestPlacePhotoUrlsBatch,
  type PlacePhotoUrlBatchItem,
} from "@/lib/api/places";
import {
  createPlaceBatchLoader,
  type PlaceBatchResult,
} from "@/lib/places/place-batch-loader";

/**
 * `usePlacePhotoUrlQuery` — 같은 `googlePlaceId`에 대해 불필요한 `GET /places/photos` 재호출 방지.
 */
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
  // 항목 실패는 외부 API 실패(EXTERNAL_API_ERROR)일 때만 온다 — 단건으로 보냈으면 502였을 실패다
  return {
    ok: false,
    error: new HttpError(502, `장소 사진 URL 조회 실패: ${item.errorCode ?? item.status}`),
  };
}

/** 같은 커밋에 보이는 카드 사진을 모아 받는다 — 1장이면 단건, 2장 이상이면 batch */
export const loadPlacePhotoUrl = createPlaceBatchLoader<string>({
  fetchOne: (id) => requestPlacePhotoUrl(id),
  fetchMany: async (ids) =>
    new Map(
      (await requestPlacePhotoUrlsBatch(ids)).map(
        (item): [string, PlaceBatchResult<string>] => [
          item.googlePlaceId.trim(),
          photoBatchItemResult(item),
        ],
      ),
    ),
});
