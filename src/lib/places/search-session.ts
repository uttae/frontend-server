import {
  resolvePlaceSession, PlaceSessionError,
  type PlacePrediction, type PlaceResolveResponse, type PlaceSession,
} from "@/lib/api/place-sessions";
import { getQueryClient } from "@/lib/query-client";
import { placeDetailQueryKey, normalizePreviewLocation } from "./place-queries";

export type SearchConfirmation = {
  query: string;
  kind: "whole" | "specific";
  prediction?: PlacePrediction;
  /** Issued token from the successful autocomplete that supplied this prediction. */
  session: PlaceSession | null;
  generation: number;
};
export type ResolvedSearchAnchor = PlaceResolveResponse & {
  googlePlaceId: string;
  location: google.maps.LatLngLiteral;
};
const resolutions = new WeakMap<PlaceSession, {
  googlePlaceId: string; promise: Promise<PlaceResolveResponse>;
}>();
/** Errors remain tied to this operation; cancel/timeout never prove Google was not called. */
export function terminatePredictionSession(
  prediction: PlacePrediction, session: PlaceSession | null, isCurrent: () => boolean = () => true,
): Promise<PlaceResolveResponse> {
  if (!session || session.expiresAt <= Date.now())
    return Promise.reject(new PlaceSessionError(400, "PLACE_SESSION_INVALID", "검색 세션이 만료됐어요. 다시 입력해주세요."));
  const existing = resolutions.get(session);
  if (existing) return existing.googlePlaceId === prediction.placeId ? existing.promise
    : Promise.reject(new PlaceSessionError(409, "PLACE_SESSION_CONFLICT", "이미 확인한 검색 세션입니다. 다시 검색해주세요."));
  const promise = (async () => {
    // Only IN_PROGRESS is known to permit a bounded delayed same-token/place retry.
    for (let attempt = 0; ; attempt++) {
      try { return await resolvePlaceSession(session.sessionToken, prediction.placeId); }
      catch (error) {
        if (!(error instanceof PlaceSessionError) || error.code !== "PLACE_SESSION_IN_PROGRESS" || attempt >= 1) throw error;
        await new Promise(r => setTimeout(r, 300));
        if (!isCurrent()) throw new DOMException("Search abandoned", "AbortError");
      }
    }
  })();
  resolutions.set(session, { googlePlaceId: prediction.placeId, promise });
  return promise;
}
export async function confirmPlaceSearch<T>(args: Omit<SearchConfirmation, "generation"> & {
  mapCenter: google.maps.LatLngLiteral | null;
  isCurrent: () => boolean;
  onAnchor?: (anchor: ResolvedSearchAnchor) => void;
  onResolved?: (resolved: PlaceResolveResponse) => void;
  search: (params: { query: string; latitude: number; longitude: number; radius: number }) => Promise<T[]>;
}): Promise<{
  anchor: ResolvedSearchAnchor | null; items: T[]; fallback: boolean;
  termination: PlaceResolveResponse["termination"] | "failed" | "not-requested";
} | null> {
  const query = args.query.trim();
  if (!query) throw new Error("검색어를 입력해주세요.");
  if (!args.isCurrent()) return null;
  let anchor: ResolvedSearchAnchor | null = null;
  let termination: PlaceResolveResponse["termination"] | "failed" | "not-requested" = "not-requested";
  if (args.prediction) {
    try {
      const resolved = await terminatePredictionSession(args.prediction, args.session, args.isCurrent);
      if (!args.isCurrent()) return null;
      termination = resolved.termination;
      // Seed the complete untouched server DTO BEFORE a detail consumer mounts.
      getQueryClient()?.setQueryData(placeDetailQueryKey(resolved.detail.googlePlaceId), resolved.detail);
      args.onResolved?.(resolved);
      const location = normalizePreviewLocation(resolved.detail.location);
      if (location && Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180)
        anchor = { ...resolved, googlePlaceId: resolved.detail.googlePlaceId, location };
      else if (args.kind === "specific") throw new Error("장소 좌표를 확인할 수 없어요.");
    } catch (error) {
      // Coordinate absence does not erase a verified server termination.
      if (termination === "not-requested") termination = "failed";
      if (args.kind === "specific" && args.isCurrent()) throw error;
    }
  }
  if (!args.isCurrent()) return null;
  if (anchor) args.onAnchor?.(anchor);
  if (args.kind === "specific") {
    if (!anchor) throw new Error("장소 정보를 확인할 수 없어요.");
    return { anchor, items: [], fallback: false, termination };
  }
  const center = anchor?.location ?? args.mapCenter;
  if (!center) throw new Error("지도 위치를 확인한 뒤 다시 검색해주세요.");
  const items = await args.search({ query, latitude: center.lat, longitude: center.lng, radius: 5000 });
  if (!args.isCurrent()) return null;
  return { anchor, items, fallback: !anchor, termination };
}
