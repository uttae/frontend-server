import type { QueryClient } from "@tanstack/react-query";

import { requestPlacePhotoUrl } from "@/lib/api/places";
import { logPlacePhotoImageError } from "@/lib/debug/photo-url-events";
import { placePhotoUrlQueryKey } from "@/lib/place-photo-query";
import { getQueryClient } from "@/lib/query-client";

const inFlightRefreshByPlaceId = new Map<string, Promise<string>>();

function describeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }
  return {
    errorName: typeof error,
    errorMessage: String(error),
    errorStack: null,
  };
}

export async function refreshPlacePhotoUrl(
  googlePlaceId: string,
  queryClient?: QueryClient | null,
): Promise<string> {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  if (!id.length) return "";

  const existing = inFlightRefreshByPlaceId.get(id);
  if (existing) return existing;

  const refreshPromise = (async () => {
    try {
      const freshUrl = await requestPlacePhotoUrl(id, { refresh: true });
      const trimmed = typeof freshUrl === "string" ? freshUrl.trim() : "";
      if (trimmed.length > 0) {
        const qc = queryClient ?? getQueryClient();
        qc?.setQueryData(placePhotoUrlQueryKey(id), trimmed, {
          updatedAt: Date.now(),
        });
      }
      return trimmed;
    } finally {
      inFlightRefreshByPlaceId.delete(id);
    }
  })();

  inFlightRefreshByPlaceId.set(id, refreshPromise);
  return refreshPromise;
}

export function handlePlacePhotoImageError(args: {
  source: string;
  googlePlaceId?: string | null;
  placeName?: string | null;
  image: HTMLImageElement;
  /** 다시 받아도 보여 줄 사진이 없을 때 — 깨진 이미지 대신 사진 없음 상태로 바꾸게 한다 */
  onPhotoUnavailable?: () => void;
}): void {
  logPlacePhotoImageError(args);

  const id =
    typeof args.googlePlaceId === "string" ? args.googlePlaceId.trim() : "";
  if (!id.length || args.image.dataset.photoRefreshAttempted === "true") {
    args.onPhotoUnavailable?.();
    return;
  }

  args.image.dataset.photoRefreshAttempted = "true";
  void refreshPlacePhotoUrl(id)
    .then((freshUrl) => {
      if (freshUrl && args.image.isConnected) {
        args.image.src = freshUrl;
        return;
      }
      console.warn("[PHOTO-URL] refresh empty", {
        source: args.source,
        googlePlaceId: id,
        placeName: args.placeName ?? null,
        imageConnected: args.image.isConnected,
      });
      args.onPhotoUnavailable?.();
    })
    .catch((error: unknown) => {
      console.warn("[PHOTO-URL] refresh failed", {
        source: args.source,
        googlePlaceId: id,
        placeName: args.placeName ?? null,
        ...describeUnknownError(error),
      });
      args.onPhotoUnavailable?.();
    });
}
