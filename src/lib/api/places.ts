import { API_BASE } from "./config";
import { apiFetch } from "./client";
import { chunkArray, PLACE_BATCH_MAX_SIZE } from "./batch-chunk";
import { readUserFacingMessageFromApiBody } from "./errors";
import { apiUrl, jsonBody, requestJson, tryParseJson } from "./http";

// ─── Response types ────────────────────────────────────────────────────────

export type PlaceSearchItem = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  primaryType: string;
  primaryTypeDisplayName: string;
  rating: number;
  userRatingCount: number;
  openNow: boolean;
};

export type PlaceSearchPageResponse = {
  items: PlaceSearchItem[];
  nextPageToken: string | null;
};

export type PlaceReview = {
  rating: number | null; text: string | null; authorDisplayName: string | null;
  publishTime: string | null; relativePublishTimeDescription: string | null;
};
export type PlaceDateParts = { year: number | null; month: number | null; day: number | null };
export type PlaceTimePoint = {
  day: number | null; hour: number | null; minute: number | null;
  date: PlaceDateParts | null; truncated: boolean | null;
};
export type PlaceDetail = {
  googlePlaceId: string;
  name: string | null; formattedAddress: string | null;
  location: { lat: number | null; lng: number | null } | null;
  primaryType: string | null; primaryTypeDisplayName: string | null;
  rating: number | null; userRatingCount: number | null;
  phoneNumber: string | null; websiteUri: string | null; googleMapsUri: string | null;
  googleMapsLinks: {
    placeUri: string | null; directionsUri: string | null; writeAReviewUri: string | null;
    reviewsUri: string | null; photosUri: string | null;
  } | null;
  regularOpeningHours: {
    openNow: boolean | null; secondaryHoursType: string | null;
    specialDays: { date: PlaceDateParts | null }[];
    periods: { open: PlaceTimePoint | null; close: PlaceTimePoint | null }[];
    weekdayDescriptions: string[];
    nextOpenTime: string | null; nextCloseTime: string | null;
  } | null;
  /** Legacy optional field, absent from the backend GET/resolve DTO. */
  reviewSummary?: string | null;
  reviews: PlaceReview[];
};

export type PlacePhotoResponse = {
  photoUrl: string | null;
};

/** Raw JSON from `GET /places/{googlePlaceId}/preview` */
export type PlacePreviewResponse = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  location: { latitude: number; longitude: number } | null;
  primaryType: string;
  primaryTypeDisplayName: string;
};

/** Client-normalized preview (coordinates match detail/search shape) */
export type PlacePreview = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  location?: { lat: number; lng: number };
  primaryType?: string;
  primaryTypeDisplayName?: string;
};

// ─── Batch response types ──────────────────────────────────────────────────

export type PlacePreviewBatchItem =
  | ({
      status: "OK";
      googlePlaceId: string;
      name: string;
      formattedAddress: string;
      location: { latitude: number; longitude: number } | null;
      primaryType: string;
      primaryTypeDisplayName: string;
    })
  | {
      status: "ERROR";
      googlePlaceId: string;
      errorCode?: string;
    };

export type PlacePreviewBatchResponse = {
  /** 서버 명세 — `POST /places/previews/batch` */
  previews?: PlacePreviewBatchItem[];
  /** 레거시·내부 호환 */
  items?: PlacePreviewBatchItem[];
};

export type PlacePhotoUrlBatchItem =
  | {
      status: "OK";
      googlePlaceId: string;
      photoUrl?: string | null;
      errorCode?: string | null;
    }
  | { status: "ERROR" | "FAILED"; googlePlaceId: string; errorCode?: string };

export type PlacePhotoUrlBatchResponse = {
  /** 서버 명세 — `POST /places/photos/batch` */
  photos?: PlacePhotoUrlBatchItem[];
  /** 레거시·내부 호환 */
  items?: PlacePhotoUrlBatchItem[];
};

function readBatchResponseList<T>(
  data: Record<string, unknown>,
  primaryKey: string,
): T[] {
  const primary = data[primaryKey];
  if (Array.isArray(primary)) return primary as T[];
  const legacy = data.items;
  if (Array.isArray(legacy)) return legacy as T[];
  return [];
}

// ─── API functions ─────────────────────────────────────────────────────────

export async function searchPlaces(params: {
  query: string;
  latitude: number;
  longitude: number;
  radius?: number;
  pageSize?: number;
  pageToken?: string;
}): Promise<PlaceSearchPageResponse> {
  const url = new URL(`${API_BASE}/places/search`);
  url.searchParams.set("query", params.query);
  url.searchParams.set("latitude", String(params.latitude));
  url.searchParams.set("longitude", String(params.longitude));
  if (params.radius !== undefined) {
    url.searchParams.set("radius", String(params.radius));
  }
  if (params.pageSize !== undefined) {
    url.searchParams.set("pageSize", String(params.pageSize));
  }
  if (params.pageToken) {
    url.searchParams.set("pageToken", params.pageToken);
  }

  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Places search failed: ${res.status}`);
  return res.json();
}

export async function requestPlaceDetail(
  googlePlaceId: string,
): Promise<PlaceDetail> {
  const res = await apiFetch(
    `${API_BASE}/places/${encodeURIComponent(googlePlaceId)}`,
  );
  if (!res.ok) throw new Error(`Place detail failed: ${res.status}`);
  return res.json();
}

export async function requestPlacePreview(
  googlePlaceId: string,
): Promise<PlacePreviewResponse> {
  const res = await apiFetch(
    `${API_BASE}/places/${encodeURIComponent(googlePlaceId)}/preview`,
  );
  if (!res.ok) throw new Error(`Place preview failed: ${res.status}`);
  return res.json();
}

export async function requestPlacePhotoUrl(
  googlePlaceId: string,
  options?: { refresh?: boolean },
): Promise<string> {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  const url = new URL(`${API_BASE}/places/photos`);
  url.searchParams.set("googlePlaceId", id);
  if (options?.refresh === true) {
    url.searchParams.set("refresh", "true");
  }

  const res = await apiFetch(url.toString());
  if (res.status === 204) return "";
  if (!res.ok) {
    const body = await tryParseJson(res);
    const detail = readUserFacingMessageFromApiBody(body);
    throw new Error(detail ?? `Place photo failed: ${res.status}`);
  }
  const data: PlacePhotoResponse = await res.json();
  return typeof data.photoUrl === "string" ? data.photoUrl : "";
}

async function requestPlacePreviewsBatchChunk(
  googlePlaceIds: string[],
): Promise<PlacePreviewBatchItem[]> {
  const data = await requestJson<PlacePreviewBatchResponse>(
    apiUrl("/places/previews/batch"),
    { method: "POST", ...jsonBody({ googlePlaceIds }) },
    { errorMessage: "장소 미리보기 일괄 조회 실패" },
  );
  return readBatchResponseList<PlacePreviewBatchItem>(data, "previews");
}

export async function requestPlacePreviewsBatch(
  googlePlaceIds: readonly string[],
): Promise<PlacePreviewBatchItem[]> {
  const ids = [
    ...new Set(
      googlePlaceIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  ];
  if (!ids.length) return [];

  const chunks = chunkArray(ids, PLACE_BATCH_MAX_SIZE);
  const out: PlacePreviewBatchItem[] = [];
  for (const chunk of chunks) {
    out.push(...(await requestPlacePreviewsBatchChunk(chunk)));
  }
  return out;
}

async function requestPlacePhotoUrlsBatchChunk(
  googlePlaceIds: string[],
  options?: { refresh?: boolean },
): Promise<PlacePhotoUrlBatchItem[]> {
  const res = await apiFetch(apiUrl("/places/photos/batch"), {
    method: "POST",
    ...jsonBody({
      googlePlaceIds,
      ...(options?.refresh === true ? { refresh: true } : {}),
    }),
  });
  if (res.status === 204) {
    return googlePlaceIds.map((googlePlaceId) => ({
      status: "OK",
      googlePlaceId,
      photoUrl: null,
    }));
  }
  if (!res.ok) {
    const body = await tryParseJson(res);
    const detail = readUserFacingMessageFromApiBody(body);
    throw new Error(detail ?? `장소 사진 URL 일괄 조회 실패: ${res.status}`);
  }
  const data = (await res.json()) as PlacePhotoUrlBatchResponse;
  return readBatchResponseList<PlacePhotoUrlBatchItem>(data, "photos");
}

export async function requestPlacePhotoUrlsBatch(
  googlePlaceIds: readonly string[],
  options?: { refresh?: boolean },
): Promise<PlacePhotoUrlBatchItem[]> {
  const ids = [
    ...new Set(
      googlePlaceIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  ];
  if (!ids.length) return [];

  const chunks = chunkArray(ids, PLACE_BATCH_MAX_SIZE);
  const out: PlacePhotoUrlBatchItem[] = [];
  for (const chunk of chunks) {
    out.push(...(await requestPlacePhotoUrlsBatchChunk(chunk, options)));
  }
  return out;
}
