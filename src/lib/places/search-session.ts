/** Location-only SDK response. Never write this value to the full detail cache. */
export type PredictionCoordinates = {
  kind: "coordinates";
  googlePlaceId: string;
  location: google.maps.LatLngLiteral;
  termination: "completed";
};
export type SearchConfirmation = {
  query: string;
  kind: "whole" | "specific";
  prediction?: google.maps.places.PlacePrediction;
  /** Identity of the token used by the actual prediction request. */
  session: object;
  generation: number;
};
const terminations = new WeakMap<
  object,
  { googlePlaceId: string; promise: Promise<PredictionCoordinates> }
>();

/** A consumed session remains single-flight even if its terminating request fails. */
export function terminatePredictionSession(
  prediction: google.maps.places.PlacePrediction,
  session: object,
): Promise<PredictionCoordinates> {
  const pending = terminations.get(session);
  if (pending)
    return pending.googlePlaceId === prediction.placeId
      ? pending.promise
      : Promise.reject(
          new Error("이미 확인한 검색 세션입니다. 다시 검색해주세요."),
        );
  const request = (async (): Promise<PredictionCoordinates> => {
    const place = prediction.toPlace();
    await place.fetchFields({ fields: ["location"] });
    const lat = place.location?.lat();
    const lng = place.location?.lng();
    if (
      lat == null ||
      lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new Error("장소 좌표를 확인할 수 없어요.");
    }
    return {
      kind: "coordinates",
      googlePlaceId: prediction.placeId,
      location: { lat, lng },
      termination: "completed",
    };
  })();
  terminations.set(session, {
    googlePlaceId: prediction.placeId,
    promise: request,
  });
  return request;
}

export async function confirmPlaceSearch<T>(
  args: Omit<SearchConfirmation, "generation"> & {
    mapCenter: google.maps.LatLngLiteral | null;
    isCurrent: () => boolean;
    onAnchor?: (anchor: PredictionCoordinates) => void;
    search: (params: {
      query: string;
      latitude: number;
      longitude: number;
      radius: number;
    }) => Promise<T[]>;
  },
): Promise<{
  anchor: PredictionCoordinates | null;
  items: T[];
  fallback: boolean;
  termination: "completed" | "failed" | "not-requested";
} | null> {
  const query = args.query.trim();
  if (!query) throw new Error("검색어를 입력해주세요.");
  if (!args.isCurrent()) return null;
  let anchor: PredictionCoordinates | null = null;
  let termination: "completed" | "failed" | "not-requested" = "not-requested";
  if (args.prediction) {
    try {
      anchor = await terminatePredictionSession(args.prediction, args.session);
      termination = "completed";
    } catch (error) {
      termination = "failed";
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
  const items = await args.search({
    query,
    latitude: center.lat,
    longitude: center.lng,
    radius: 5000,
  });
  if (!args.isCurrent()) return null;
  return { anchor, items, fallback: !anchor, termination };
}
