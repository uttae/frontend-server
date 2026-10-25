import { isBatchItemError, isBatchItemOk } from "@/lib/api/batch-types";
import { HttpError } from "@/lib/api/errors";
import {
  requestPlaceDetail,
  requestPlacePreview,
  requestPlacePreviewsBatch,
  type PlaceDetail,
  type PlacePreview,
  type PlacePreviewBatchItem,
  type PlacePreviewResponse,
} from "@/lib/api/places";
import { normalizeGooglePlaceResourceId } from "@/lib/maps";
import {
  createPlaceBatchLoader,
  type PlaceBatchResult,
} from "@/lib/places/place-batch-loader";
import { getQueryClient } from "@/lib/query-client";

export const placeDetailQueryDefaults = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;

export const placePreviewQueryDefaults = {
  staleTime: 60_000,
  refetchOnWindowFocus: false,
} as const;

export function placeDetailQueryKey(googlePlaceId: string) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return ["places", "detail", normalizeGooglePlaceResourceId(id)] as const;
}

export function placePreviewQueryKey(googlePlaceId: string) {
  return ["places", "preview", resolvePreviewGooglePlaceId(googlePlaceId)] as const;
}

export function normalizePreviewLocation(
  location: PlacePreviewResponse["location"] | { lat?: number | null; lng?: number | null },
): { lat: number; lng: number } | undefined {
  if (!location || typeof location !== "object") return undefined;

  const lat =
    "latitude" in location
      ? location.latitude
      : "lat" in location
        ? location.lat
        : undefined;
  const lng =
    "longitude" in location
      ? location.longitude
      : "lng" in location
        ? location.lng
        : undefined;

  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lng !== "number" ||
    !Number.isFinite(lng)
  ) {
    return undefined;
  }
  return { lat, lng };
}

function normalizeOptionalPreviewString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizePlacePreview(raw: PlacePreviewResponse): PlacePreview {
  return {
    googlePlaceId: raw.googlePlaceId,
    name: raw.name,
    formattedAddress: raw.formattedAddress,
    location: normalizePreviewLocation(raw.location),
    primaryType: normalizeOptionalPreviewString(raw.primaryType),
    primaryTypeDisplayName: normalizeOptionalPreviewString(
      raw.primaryTypeDisplayName,
    ),
  };
}

export async function fetchPlaceDetail(googlePlaceId: string): Promise<PlaceDetail> {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  if (!id.length) {
    throw new Error("fetchPlaceDetail: empty googlePlaceId");
  }

  const queryClient = getQueryClient();
  if (!queryClient) {
    return requestPlaceDetail(id);
  }

  return queryClient.fetchQuery({
    queryKey: placeDetailQueryKey(id),
    queryFn: () => requestPlaceDetail(id),
    ...placeDetailQueryDefaults,
  });
}

export function resolvePreviewGooglePlaceId(googlePlaceId: string): string {
  const raw = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return raw.length ? normalizeGooglePlaceResourceId(raw) : "";
}

function previewBatchItemResult(
  item: PlacePreviewBatchItem,
): PlaceBatchResult<PlacePreview> | null {
  if (isBatchItemOk(item)) return { ok: true, value: normalizePlacePreview(item) };
  if (isBatchItemError(item)) {
    // 항목 실패는 외부 API 실패(EXTERNAL_API_ERROR)일 때만 온다 — 단건으로 보냈으면 502였을 실패다
    return {
      ok: false,
      error: new HttpError(502, `장소 미리보기 조회 실패: ${item.errorCode ?? item.status}`),
    };
  }
  return null;
}

/** 같은 커밋에 요청된 미리보기를 모아 받는다 — 1곳이면 단건, 2곳 이상이면 batch */
const loadPlacePreviewInBatch = createPlaceBatchLoader<PlacePreview>({
  fetchOne: async (id) => normalizePlacePreview(await requestPlacePreview(id)),
  fetchMany: async (ids) => {
    const results = new Map<string, PlaceBatchResult<PlacePreview>>();
    for (const item of await requestPlacePreviewsBatch(ids)) {
      const result = previewBatchItemResult(item);
      if (result) results.set(resolvePreviewGooglePlaceId(item.googlePlaceId), result);
    }
    return results;
  },
});

/** useQueries queryFn 등 중첩 fetchQuery 없이 preview API만 호출 */
export async function loadPlacePreview(googlePlaceId: string): Promise<PlacePreview> {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  if (!id.length) {
    throw new Error("loadPlacePreview: empty googlePlaceId");
  }
  const raw = await requestPlacePreview(id);
  return normalizePlacePreview(raw);
}

/**
 * 북마크·일정 카드 등 `useQueries`용 — `fetchPlacePreview`와 동일 `placePreviewQueryKey`·60s 캐시.
 * 같은 커밋에 마운트된 미리보기(북마크 목록·지도 핀)는 batch 하나로 모은다.
 */
export function placePreviewQueryOptions(googlePlaceId: string) {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  return {
    queryKey: placePreviewQueryKey(id),
    queryFn: () => loadPlacePreviewInBatch(id),
    enabled: id.length > 0,
    ...placePreviewQueryDefaults,
  };
}

/**
 * batch 시딩 후 캐시만 구독 — GET `/preview` fallback 없음.
 * `enabled`는 batch 완료 후 true로 두세요.
 */
export function seededPlacePreviewQueryOptions(
  googlePlaceId: string,
  options?: { enabled?: boolean },
) {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  const enabled = (options?.enabled ?? true) && id.length > 0;
  return {
    queryKey: placePreviewQueryKey(id),
    queryFn: (): PlacePreview => {
      const queryClient = getQueryClient();
      const cached = queryClient?.getQueryData<PlacePreview>(
        placePreviewQueryKey(id),
      );
      if (cached) return cached;
      throw new Error("Place preview not seeded");
    },
    enabled,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  };
}

export async function fetchPlacePreview(googlePlaceId: string): Promise<PlacePreview> {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  if (!id.length) {
    throw new Error("fetchPlacePreview: empty googlePlaceId");
  }

  const queryClient = getQueryClient();
  if (!queryClient) {
    return loadPlacePreview(id);
  }

  return queryClient.fetchQuery({
    queryKey: placePreviewQueryKey(id),
    queryFn: () => loadPlacePreview(id),
    ...placePreviewQueryDefaults,
  });
}
