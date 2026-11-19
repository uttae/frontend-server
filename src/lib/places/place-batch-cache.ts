import type { QueryClient } from "@tanstack/react-query";

import type { PlacePreview } from "@/lib/api/places";
import {
  placePreviewQueryDefaults,
  placePreviewQueryKey,
  placePreviewQueryOptions,
  resolvePreviewGooglePlaceId,
} from "@/lib/places/place-queries";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { getQueryClient } from "@/lib/query-client";

const PLAN_PLACE_PREVIEW_ERROR_TITLE = "장소 정보를 불러올 수 없음";

function readCachedPreviewForReconcile(
  queryClient: QueryClient,
  googlePlaceId: string,
): PlacePreview | null {
  const id = resolvePreviewGooglePlaceId(googlePlaceId);
  if (!id.length) return null;
  return queryClient.getQueryData<PlacePreview>(placePreviewQueryKey(id)) ?? null;
}

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

export async function fetchAndSeedPlacePreviews(
  googlePlaceIds: readonly string[],
  queryClient?: QueryClient | null,
): Promise<void> {
  const qc = queryClient ?? getQueryClient();
  if (!qc) return;

  const missing = uncachedPreviewIds(qc, googlePlaceIds);
  if (!missing.length) return;

  await Promise.allSettled(missing.map((id) => qc.fetchQuery(placePreviewQueryOptions(id))));
  reconcileSchedulePlanPlacesAfterPreviewSeed(qc);
}

export { placePreviewQueryDefaults };
