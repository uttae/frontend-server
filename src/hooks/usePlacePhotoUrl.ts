import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { requestPlacePhotoUrl } from "@/lib/api/places";
import { fetchAndSeedPlacePhotoUrls } from "@/lib/places/place-batch-cache";
import {
  PLACE_PHOTO_QUERY_GC_MS,
  placePhotoUrlQueryDefaults,
  placePhotoUrlQueryKey,
  seededPlacePhotoUrlQueryOptions,
} from "@/lib/place-photo-query";
import { getQueryClient } from "@/lib/query-client";

export function usePlacePhotoUrlQuery(
  googlePlaceId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  const queryKey = placePhotoUrlQueryKey(id);
  return useQuery({
    queryKey,
    queryFn: () => requestPlacePhotoUrl(id),
    enabled: id.length > 0 && (options?.enabled ?? true),
    ...placePhotoUrlQueryDefaults,
  });
}

export function useSeededPlacePhotoUrlQuery(
  googlePlaceId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return useQuery(
    seededPlacePhotoUrlQueryOptions(id, {
      enabled: (options?.enabled ?? true) && id.length > 0,
    }),
  );
}

/**
 * 여러 googlePlaceId를 단일 카드와 동일한 `["places","photoUrl",id]` 캐시 키로 해석.
 * 미캐시 id는 batch API 1회로 시딩 후 개별 query subscribe.
 */
export function usePlacePhotoUrlsQuery(
  googlePlaceIds: readonly (string | null | undefined)[] | null | undefined,
) {
  const ids = useMemo(
    () =>
      (googlePlaceIds ?? [])
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    [googlePlaceIds],
  );

  const idsKey = ids.join("\0");

  const seedQuery = useQuery({
    queryKey: ["places", "photoUrlsSeed", idsKey],
    queryFn: async () => {
      await fetchAndSeedPlacePhotoUrls(ids, getQueryClient());
      return true;
    },
    enabled: ids.length > 0,
    staleTime: Infinity,
    gcTime: PLACE_PHOTO_QUERY_GC_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const photosSeeded = ids.length === 0 || seedQuery.isSuccess;

  const results = useQueries({
    queries: ids.map((id) =>
      seededPlacePhotoUrlQueryOptions(id, { enabled: photosSeeded }),
    ),
  });

  const photoUrls = useMemo(
    () =>
      results
        .map((r) => (typeof r.data === "string" ? r.data.trim() : ""))
        .filter((u) => u.length > 0),
    [results],
  );

  const isLoading =
    ids.length > 0 &&
    (seedQuery.isLoading || !photosSeeded || results.some((r) => r.isLoading));

  return { photoUrls, isLoading };
}
