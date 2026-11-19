/**
 * 플랜 일차(scheduleId)마다 고정 경로·핀·순서 뱃지 색 (#RRGGBB).
 * 펼침 토글과 무관하게 방 내 일차 정렬 순서로 정한다. 1일차는 모든 방에서 Figma primary(하늘색, `--blue-700`)이고
 * 2일차부터 그 hue에서 황금각만큼 돌린다.
 */

const GOLDEN_ANGLE_HUE_STEP = 137.5083565656715;
const FIRST_DAY_ROUTE_COLOR = "#0183ff";
const FIRST_DAY_ROUTE_HUE = 211;

/** H,S,L 모두 표준 표기: H° 0–360, S와 L은 0–100 */
function hslToRgb(hDeg: number, sPct: number, lPct: number): [number, number, number] {
  const hNorm = ((((hDeg % 360) + 360) % 360) / 360);
  const s = Math.max(0, Math.min(100, sPct)) / 100;
  const l = Math.max(0, Math.min(100, lPct)) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  function hueToRgb(pp: number, qq: number, tt: number) {
    let t = tt;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return pp + (qq - pp) * 6 * t;
    if (t < 1 / 2) return qq;
    if (t < 2 / 3) return pp + (qq - pp) * (2 / 3 - t) * 6;
    return pp;
  }

  const qq = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const pp = 2 * l - qq;
  const rr = hueToRgb(pp, qq, hNorm + 1 / 3);
  const gg = hueToRgb(pp, qq, hNorm);
  const bb = hueToRgb(pp, qq, hNorm - 1 / 3);
  return [
    Math.round(rr * 255),
    Math.round(gg * 255),
    Math.round(bb * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** 방에 속한 모든 일차 id(펼침 여부 무관), 오름차순 */
export function sortedScheduleIdsForRouteColors(
  scheduleIdsByPresence: Record<number, boolean>,
): number[] {
  return Object.keys(scheduleIdsByPresence)
    .map((k) => Number(k))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);
}

/** @param sortedScheduleIds `sortedScheduleIdsForRouteColors` 결과(전체 일차, 정렬됨) */
export function scheduleIdsToRouteColors(sortedScheduleIds: number[]): Map<number, string> {
  const map = new Map<number, string>();
  sortedScheduleIds.forEach((id, i) => {
    if (i === 0) {
      map.set(id, FIRST_DAY_ROUTE_COLOR);
      return;
    }
    const hue = (FIRST_DAY_ROUTE_HUE + i * GOLDEN_ANGLE_HUE_STEP) % 360;
    const [r, g, b] = hslToRgb(hue, 72, 48); // 채도·명도 고정으로 지도 위 가독성 유지
    map.set(id, rgbToHex(r, g, b));
  });
  return map;
}
