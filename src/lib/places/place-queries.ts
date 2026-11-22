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
import { createPlaceBatchLoader, type PlaceBatchResult } from "@/lib/places/place-batch-loader";
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

  let lat: unknown;
  let lng: unknown;
  if ("latitude" in location) lat = location.latitude;
  else if ("lat" in location) lat = location.lat;
  if ("longitude" in location) lng = location.longitude;
  else if ("lng" in location) lng = location.lng;

  if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lng !== "number" || !Number.isFinite(lng)) {
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
    primaryTypeDisplayName: normalizeOptionalPreviewString(raw.primaryTypeDisplayName),
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

function hasPreviewIdAndName({ googlePlaceId, name }: { googlePlaceId?: unknown; name?: unknown }): boolean {
  return (
    typeof googlePlaceId === "string" &&
    googlePlaceId.trim().length > 0 &&
    typeof name === "string" &&
    name.trim().length > 0
  );
}

function previewBatchItemResult(item: PlacePreviewBatchItem): PlaceBatchResult<PlacePreview> | null {
  if (isBatchItemError(item)) {
    return {
      ok: false,
      error: new HttpError(502, `장소 미리보기 조회 실패: ${item.errorCode ?? item.status}`),
    };
  }
  if (isBatchItemOk(item) || hasPreviewIdAndName(item)) {
    return { ok: true, value: normalizePlacePreview(item) };
  }
  return null;
}

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

export async function loadPlacePreview(googlePlaceId: string): Promise<PlacePreview> {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  if (!id.length) {
    throw new Error("loadPlacePreview: empty googlePlaceId");
  }
  const raw = await requestPlacePreview(id);
  return normalizePlacePreview(raw);
}

export function placePreviewQueryOptions(googlePlaceId: string) {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  return {
    queryKey: placePreviewQueryKey(id),
    queryFn: () => loadPlacePreviewInBatch(id),
    enabled: id.length > 0,
    ...placePreviewQueryDefaults,
  };
}

export function seededPlacePreviewQueryOptions(googlePlaceId: string, options?: { enabled?: boolean }) {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  const enabled = (options?.enabled ?? true) && id.length > 0;
  return {
    queryKey: placePreviewQueryKey(id),
    queryFn: (): PlacePreview => {
      const queryClient = getQueryClient();
      const cached = queryClient?.getQueryData<PlacePreview>(placePreviewQueryKey(id));
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
