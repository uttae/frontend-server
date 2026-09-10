"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  searchPlaces,
  type PlaceSearchItem,
} from "@/lib/api/places";
import type { SearchResultCardProps } from "@/types/place";

export type PlaceSearchResult = SearchResultCardProps & {
  googlePlaceId: string;
  location: { lat: number; lng: number };
};

export type PlaceSearchPage = {
  items: PlaceSearchResult[];
  nextPageToken: string | null;
};

function mapPlaceSearchItem(
  item: PlaceSearchItem,
): Omit<PlaceSearchResult, "image"> {
  return {
    googlePlaceId: item.googlePlaceId,
    name: item.name,
    category: item.primaryTypeDisplayName || item.primaryType,
    address: item.formattedAddress,
    rating: item.rating,
    userRatingCount: item.userRatingCount,
    isOpen: item.openNow,
    location: item.location,
  };
}

export async function fetchPlacesPageWithPhotos(args: {
  query: string;
  latitude: number;
  longitude: number;
  radius: number | undefined;
  pageSize: number;
  pageToken: string | undefined;
}): Promise<PlaceSearchPage> {
  const { items: rawItems, nextPageToken } = await searchPlaces({
    query: args.query,
    latitude: args.latitude,
    longitude: args.longitude,
    radius: args.radius,
    pageSize: args.pageSize,
    pageToken: args.pageToken,
  });

  const itemsBase = rawItems.map((item) => mapPlaceSearchItem(item));
  return { items: itemsBase, nextPageToken };
}

export function placesSearchQueryKey(
  query: string,
  latitude: number | null,
  longitude: number | null,
  radius: number | undefined,
  pageSize: number,
  pageIndex: number,
) {
  return [
    "places",
    "search",
    query,
    latitude,
    longitude,
    radius,
    pageSize,
    pageIndex,
  ] as const;
}

type SearchSessionKey = string;

function buildSearchSessionKey(
  query: string,
  latitude: number,
  longitude: number,
  radius: number | undefined,
  pageSize: number,
): SearchSessionKey {
  return [query, latitude, longitude, radius ?? "", pageSize].join("|");
}

function sessionKeyFromPlacesSearchQueryKey(
  queryKey: readonly unknown[],
): SearchSessionKey {
  return [queryKey[2], queryKey[3], queryKey[4], queryKey[5], queryKey[6]].join(
    "|",
  );
}

export function usePlacesSearch(
  query: string,
  latitude: number | null,
  longitude: number | null,
  radius: number | undefined,
  pageSize: number,
  /** 검색·재검색 커밋마다 증가 — pageToken·pageIndex를 0으로 동기 리셋 */
  searchGeneration: number,
) {
  const trimmedQuery = query.trim();
  const enabled =
    trimmedQuery.length > 0 &&
    latitude !== null &&
    longitude !== null &&
    pageSize > 0;

  const sessionKey = enabled
    ? buildSearchSessionKey(trimmedQuery, latitude!, longitude!, radius, pageSize)
    : "";

  const paginationEpoch = enabled
    ? `${sessionKey}@${searchGeneration}`
    : `disabled@${searchGeneration}`;

  const [pagination, setPagination] = useState({
    epoch: paginationEpoch,
    pageIndex: 0,
    tokens: [undefined] as (string | undefined)[],
  });
  const current = pagination.epoch === paginationEpoch
    ? pagination
    : { epoch: paginationEpoch, pageIndex: 0, tokens: [undefined] };
  if (pagination.epoch !== paginationEpoch) {
    setPagination(current);
  }
  const { pageIndex } = current;
  const pageToken = current.tokens[pageIndex];

  const queryResult = useQuery({
    queryKey: [...placesSearchQueryKey(
      trimmedQuery,
      latitude,
      longitude,
      radius,
      pageSize,
      pageIndex,
    ), searchGeneration],
    queryFn: () =>
      fetchPlacesPageWithPhotos({
        query: trimmedQuery,
        latitude: latitude!,
        longitude: longitude!,
        radius,
        pageSize,
        pageToken,
      }),
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData, previousQuery) => {
      if (!previousData || !previousQuery) return undefined;
      return sessionKeyFromPlacesSearchQueryKey(previousQuery.queryKey) ===
        sessionKey && previousQuery.queryKey[8] === searchGeneration
        ? previousData
        : undefined;
    },
  });

  const items = queryResult.data?.items ?? [];
  const nextPageToken = queryResult.isPlaceholderData
    ? null
    : queryResult.data?.nextPageToken;
  const hasNextPage = Boolean(nextPageToken);
  const hasPreviousPage = pageIndex > 0;

  const goToPreviousPage = useCallback(() => {
    setPagination((prev) => prev.epoch === paginationEpoch
      ? { ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }
      : prev);
  }, [paginationEpoch, setPagination]);

  const goToNextPage = useCallback(() => {
    if (!nextPageToken || queryResult.isFetching) return;
    setPagination((prev) => {
      if (prev.epoch !== paginationEpoch || prev.pageIndex !== pageIndex) return prev;
      const tokens = prev.tokens.slice(0, pageIndex + 1);
      tokens.push(nextPageToken);
      return { ...prev, tokens, pageIndex: pageIndex + 1 };
    });
  }, [nextPageToken, pageIndex, paginationEpoch, queryResult.isFetching, setPagination]);

  return {
    items,
    pageIndex,
    hasPreviousPage,
    hasNextPage,
    goToPreviousPage,
    goToNextPage,
    isPending: queryResult.isPending,
    isFetching: queryResult.isFetching,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    error: queryResult.error,
  };
}
