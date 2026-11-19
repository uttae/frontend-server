export function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters >= 1000) {
    const km = meters / 1000;
    const rounded = km >= 100 ? Math.round(km) : Number(km.toFixed(km >= 10 ? 0 : 1));
    return `${rounded}km`;
  }
  return `${Math.max(1, Math.round(meters))}m`;
}

export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0 && m > 0) return `${h} 시간 ${m} 분`;
  if (h > 0) return `${h} 시간`;
  if (m > 0) return `${m} 분`;
  return total > 0 ? "1 분 미만" : "—";
}
