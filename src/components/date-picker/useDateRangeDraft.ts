"use client";

import { useState } from "react";

import {
  confirmPickedRange,
  displayPickedRange,
  pickRangeDate,
  type DateRange,
  type PickedRange,
  type RangeEdge,
} from "./calendar";

type Session = {
  /** 이번에 달력에서 고른 날짜만 — 고르지 않은 쪽은 바깥 값(`value`)을 그대로 쓴다 */
  picked: PickedRange;
  /** 다음 클릭이 채울 칸 */
  edge: RangeEdge;
  /** 달력을 연 칸 — 달력은 이 칸 아래에 붙는다 */
  anchor: RangeEdge;
};

/**
 * 달력이 열려 있는 동안 고른 날짜 — 확인하거나 바깥을 눌러 닫을 때 고른 쪽만 `onConfirm`으로 반영한다.
 * 열 때 바깥 값을 복사해 두지 않으므로, 고르지 않은 쪽이나 아무것도 고르지 않고 닫은 경우 바깥 값을 덮어쓰지 않는다.
 */
export function useDateRangeDraft(value: DateRange, onConfirm: (next: DateRange) => void) {
  const [session, setSession] = useState<Session | null>(null);

  return {
    isOpen: session != null,
    /** 다음 클릭이 채울 칸 — 입력 칸 강조에 쓴다 */
    activeEdge: session?.edge ?? null,
    anchorEdge: session?.anchor ?? null,
    /** 열려 있으면 고른 날짜를 얹은 기간, 닫혀 있으면 바깥 값 */
    range: session ? displayPickedRange(value, session.picked) : value,
    open(edge: RangeEdge) {
      setSession((current) => {
        const picked = current?.picked ?? {};
        const { start } = displayPickedRange(value, picked);
        return { picked, edge: edge === "end" && !start ? "start" : edge, anchor: edge };
      });
    },
    pick(ymd: string) {
      setSession(
        (current) => current && { ...pickRangeDate(value, current.picked, current.edge, ymd), anchor: current.anchor },
      );
    },
    cancel() {
      setSession(null);
    },
    /** 고른 날짜가 있으면 고른 쪽만 반영하고 닫는다 (확인 버튼·바깥 클릭) */
    confirm() {
      const next = session ? confirmPickedRange(value, session.picked) : null;
      if (next) onConfirm(next);
      setSession(null);
    },
  };
}
