/**
 * 플랜 일차(scheduleId)마다 고정 경로·핀·순서 뱃지 색 (#RRGGBB).
 * 펼침 토글과 무관하게 방 내 일차 정렬 순서로 hue를 고정합니다.
 */

const GOLDEN_ANGLE_HUE_STEP = 137.5083565656715;

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

function hueSeedFromString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
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

/**
 * @param sortedScheduleIds `sortedScheduleIdsForRouteColors` 결과(전체 일차, 정렬됨)
 * @param roomId 방마다 hue 오프셋(옵션)
 */
export function scheduleIdsToRouteColors(
  sortedScheduleIds: number[],
  roomId?: string,
): Map<number, string> {
  const map = new Map<number, string>();
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const hue0 = rid.length > 0 ? hueSeedFromString(rid) : 0;
  sortedScheduleIds.forEach((id, i) => {
    const hue = (hue0 + i * GOLDEN_ANGLE_HUE_STEP) % 360;
    const [r, g, b] = hslToRgb(hue, 72, 48); // 채도·명도 고정으로 지도 위 가독성 유지
    map.set(id, rgbToHex(r, g, b));
  });
  return map;
}
