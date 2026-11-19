export type PlanMapStopForOffset = {
  scheduleId: number;
  itemId: number;
  orderIndex: number;
  location: google.maps.LatLngLiteral;
};

const COORD_KEY_DECIMALS = 5;

function coordGroupKey(loc: google.maps.LatLngLiteral): string {
  return `${loc.lat.toFixed(COORD_KEY_DECIMALS)},${loc.lng.toFixed(COORD_KEY_DECIMALS)}`;
}

export function filterVisiblePlanMapStops(
  stops: PlanMapStopForOffset[],
  expansionOrder: readonly number[],
): PlanMapStopForOffset[] {
  const scheduleRank = new Map<number, number>();
  expansionOrder.forEach((id, idx) => {
    scheduleRank.set(id, idx);
  });

  const groups = new Map<string, PlanMapStopForOffset[]>();
  for (const s of stops) {
    const k = coordGroupKey(s.location);
    const g = groups.get(k) ?? [];
    g.push(s);
    groups.set(k, g);
  }

  const out: PlanMapStopForOffset[] = [];
  for (const group of groups.values()) {
    let best = group[0]!;
    for (let i = 1; i < group.length; i += 1) {
      const s = group[i]!;
      const bestRank = scheduleRank.get(best.scheduleId) ?? -1;
      const sRank = scheduleRank.get(s.scheduleId) ?? -1;
      if (sRank > bestRank || (sRank === bestRank && s.orderIndex > best.orderIndex)) {
        best = s;
      }
    }
    out.push(best);
  }
  return out;
}
