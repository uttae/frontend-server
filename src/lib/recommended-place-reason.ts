export function stripRecommendedPlaceReasonPrefix(reason: string, placeId: string): string {
  const r = reason.trim();
  const id = placeId.trim();
  if (r.length === 0 || id.length === 0) return r;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = r.replace(new RegExp(`^${escaped}\\s*:\\s*`), "").trim();
  return stripped.length > 0 ? stripped : r;
}
