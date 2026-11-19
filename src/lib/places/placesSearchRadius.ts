export const PLACES_SEARCH_MAX_RADIUS_METERS = 50_000;

export function clampPlacesSearchRadiusMeters(radius: number): number {
  if (!Number.isFinite(radius)) return PLACES_SEARCH_MAX_RADIUS_METERS;
  return Math.min(PLACES_SEARCH_MAX_RADIUS_METERS, Math.max(1, Math.round(radius)));
}
