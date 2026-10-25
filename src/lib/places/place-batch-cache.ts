import type { QueryClient } from "@tanstack/react-query";

import type { PlacePreview, PlacePreviewBatchItem } from "@/lib/api/places";
import { requestPlacePreviewsBatch } from "@/lib/api/places";
import { isBatchItemError, isBatchItemOk } from "@/lib/api/batch-types";
import {
  normalizePlacePreview,
  placePreviewQueryDefaults,
  placePreviewQueryKey,
  resolvePreviewGooglePlaceId,
} from "@/lib/places/place-queries";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { getQueryClient } from "@/lib/query-client";

const PLAN_PLACE_PREVIEW_ERROR_TITLE = "장소 정보를 불러올 수 없음";

/** 동일 googlePlaceId에 대한 in-flight batch 요청 공유 */
const inFlightPreviewSeedByPlaceId = new Map<string, Promise<void>>();

function isUsablePreviewBatchItem(item: PlacePreviewBatchItem): boolean {
  if (isBatchItemError(item)) return false;
  if (isBatchItemOk(item)) return true;

  const record = item as {
    googlePlaceId?: unknown;
    name?: unknown;
    status?: unknown;
  };
  if (record.status === "ERROR") return false;

  const googlePlaceId =
    typeof record.googlePlaceId === "string" ? record.googlePlaceId.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  return googlePlaceId.length > 0 && name.length > 0;
}

function previewBatchItemToNormalized(
  item: PlacePreviewBatchItem,
): ReturnType<typeof normalizePlacePreview> | null {
  if (!isUsablePreviewBatchItem(item)) return null;

  const record = item as {
    googlePlaceId: string;
    name: string;
    formattedAddress?: string;
    location?: { latitude: number; longitude: number } | null;
    primaryType?: string;
    primaryTypeDisplayName?: string;
  };

  return normalizePlacePreview({
    googlePlaceId: record.googlePlaceId,
    name: record.name,
    formattedAddress: record.formattedAddress ?? "",
    location: record.location ?? null,
    primaryType: record.primaryType ?? "",
    primaryTypeDisplayName: record.primaryTypeDisplayName ?? "",
  });
}

export function seedPlacePreviewCaches(
  queryClient: QueryClient,
  items: readonly PlacePreviewBatchItem[],
): void {
  for (const item of items) {
    const preview = previewBatchItemToNormalized(item);
    if (!preview) continue;
    const id = resolvePreviewGooglePlaceId(preview.googlePlaceId);
    if (!id.length) continue;
    queryClient.setQueryData(placePreviewQueryKey(id), preview, {
      updatedAt: Date.now(),
    });
  }
  reconcileSchedulePlanPlacesAfterPreviewSeed(queryClient);
}

function readCachedPreviewForReconcile(
  queryClient: QueryClient,
  googlePlaceId: string,
): PlacePreview | null {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  if (!id.length) return null;
  return queryClient.getQueryData<PlacePreview>(placePreviewQueryKey(id)) ?? null;
}

/** preview 캐시 갱신 후 bake된 에러 title을 가진 schedule-items 캐시를 복구합니다. */
export function reconcileSchedulePlanPlacesAfterPreviewSeed(
  queryClient: QueryClient,
  roomId?: string,
): void {
  const ridFilter =
    typeof roomId === "string" && roomId.trim().length > 0
      ? roomId.trim()
      : null;

  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "schedule-items") return false;
      if (ridFilter != null && String(key[1] ?? "").trim() !== ridFilter) {
        return false;
      }
      return true;
    },
  });

  for (const query of queries) {
    const key = query.queryKey;
    const rid = String(key[1] ?? "").trim();
    const scheduleId = key[2];
    if (!rid.length || typeof scheduleId !== "number" || !Number.isFinite(scheduleId)) {
      continue;
    }

    const cacheKey = scheduleItemsQueryKey(rid, scheduleId);
    const places = queryClient.getQueryData<PlanPlace[]>(cacheKey);
    if (!places?.length) continue;

    let changed = false;
    const next = places.map((place) => {
      if (place.title !== PLAN_PLACE_PREVIEW_ERROR_TITLE) return place;
      const gid =
        typeof place.googlePlaceId === "string" ? place.googlePlaceId.trim() : "";
      if (!gid.length) return place;

      const preview = readCachedPreviewForReconcile(queryClient, gid);
      if (!preview) return place;

      changed = true;
      return {
        ...place,
        location: preview.location,
        title: preview.name,
        subtitle: preview.formattedAddress,
        primaryTypeDisplayName: preview.primaryTypeDisplayName,
      };
    });

    if (changed) {
      queryClient.setQueryData(cacheKey, next);
    }
  }
}

function uncachedPreviewIds(
  queryClient: QueryClient,
  googlePlaceIds: readonly string[],
): string[] {
  const out: string[] = [];
  for (const raw of googlePlaceIds) {
    const id = resolvePreviewGooglePlaceId(raw);
    if (!id.length) continue;
    const cached = queryClient.getQueryData(placePreviewQueryKey(id));
    if (cached != null) continue;
    out.push(id);
  }
  return [...new Set(out)];
}

async function fetchAndSeedUncachedPlacePreviews(
  missing: readonly string[],
  queryClient: QueryClient,
): Promise<void> {
  const results = await requestPlacePreviewsBatch(missing);
  seedPlacePreviewCaches(queryClient, results);

  const byNormalizedId = new Map<string, ReturnType<typeof normalizePlacePreview>>();
  for (const item of results) {
    const preview = previewBatchItemToNormalized(item);
    if (!preview) continue;
    const id = resolvePreviewGooglePlaceId(preview.googlePlaceId);
    if (!id.length) continue;
    byNormalizedId.set(id, preview);
  }

  for (const requestedId of missing) {
    const id = resolvePreviewGooglePlaceId(requestedId);
    if (!id.length) continue;
    const preview = byNormalizedId.get(id);
    if (!preview) continue;
    queryClient.setQueryData(placePreviewQueryKey(id), preview, {
      updatedAt: Date.now(),
    });
  }
}

export async function fetchAndSeedPlacePreviews(
  googlePlaceIds: readonly string[],
  queryClient?: QueryClient | null,
): Promise<void> {
  const qc = queryClient ?? getQueryClient();
  if (!qc) return;

  const missing = uncachedPreviewIds(qc, googlePlaceIds);
  if (!missing.length) return;

  const toFetch: string[] = [];
  const waits: Promise<void>[] = [];

  for (const id of missing) {
    const inFlight = inFlightPreviewSeedByPlaceId.get(id);
    if (inFlight) {
      waits.push(inFlight);
      continue;
    }
    if (!toFetch.includes(id)) {
      toFetch.push(id);
    }
  }

  let fetchPromise: Promise<void> | null = null;
  if (toFetch.length) {
    fetchPromise = (async () => {
      try {
        await fetchAndSeedUncachedPlacePreviews(toFetch, qc);
      } finally {
        for (const id of toFetch) {
          inFlightPreviewSeedByPlaceId.delete(id);
        }
      }
    })();
    for (const id of toFetch) {
      inFlightPreviewSeedByPlaceId.set(id, fetchPromise);
    }
  }

  const pending = [
    ...(fetchPromise ? [fetchPromise] : []),
    ...waits.filter((promise) => promise !== fetchPromise),
  ];
  if (pending.length) {
    await Promise.all(pending);
  }
}

export { placePreviewQueryDefaults };
