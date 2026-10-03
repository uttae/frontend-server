import { readIsMobileDevice } from "./device";

export const ORIENTATION_LANDSCAPE_MEDIA_QUERY =
  "(orientation: landscape) and (max-height: 500px)" as const;

export function readIsLandscapeOrientation(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(ORIENTATION_LANDSCAPE_MEDIA_QUERY).matches;
}

export function readIsMobileLandscape(): boolean {
  return readIsMobileDevice() && readIsLandscapeOrientation();
}
