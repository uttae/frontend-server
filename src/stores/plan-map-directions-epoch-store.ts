import { create } from "zustand";

type PlanMapSegmentEpochEntry = {
  scheduleId: number;
  segmentSourceItemId: number;
};

/** `epochBySegmentKey`: `{roomId}:{scheduleId}:{segmentSourceItemId}` */
export function planMapSegmentEpochStoreKey(
  roomId: string,
  scheduleId: number,
  segmentSourceItemId: number,
): string {
  return `${String(roomId ?? "").trim()}:${scheduleId}:${segmentSourceItemId}`;
}

/** STOMP 일정 브로드캐스트 중 지도 경로(polyline) 갱신 — 방 전체 에폭 + 구간별 에폭. */
type EpochState = {
  epochByRoomId: Record<string, number>;
  epochBySegmentKey: Record<string, number>;
  bumpForDirections: (roomId: string) => void;
  bumpSegments: (roomId: string, entries: PlanMapSegmentEpochEntry[]) => void;
};

export const usePlanMapDirectionsEpochStore = create<EpochState>((set) => ({
  epochByRoomId: {},
  epochBySegmentKey: {},
  bumpForDirections: (roomId) => {
    const rid = String(roomId ?? "").trim();
    if (!rid.length) return;
    set((s) => ({
      epochByRoomId: {
        ...s.epochByRoomId,
        [rid]: (s.epochByRoomId[rid] ?? 0) + 1,
      },
    }));
  },
  bumpSegments: (roomId, entries) => {
    const rid = String(roomId ?? "").trim();
    if (!rid.length || entries.length === 0) return;
    set((s) => {
      const next = { ...s.epochBySegmentKey };
      for (const e of entries) {
        const k = planMapSegmentEpochStoreKey(rid, e.scheduleId, e.segmentSourceItemId);
        next[k] = (next[k] ?? 0) + 1;
      }
      return { epochBySegmentKey: next };
    });
  },
}));
