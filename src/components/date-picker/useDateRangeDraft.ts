"use client";

import { useState } from "react";

import { pickRangeDate, type DateRange, type RangeEdge } from "./calendar";

type Session = {
  range: DateRange;
  /** 다음 클릭이 채울 칸 */
  edge: RangeEdge;
  /** 달력을 연 칸 — 달력은 이 칸 아래에 붙는다 */
  anchor: RangeEdge;
};

/**
 * 달력이 열려 있는 동안의 임시 기간 — 확인하거나 바깥을 눌러 닫을 때 `onConfirm`으로 반영된다.
 * 하나만 고르고 닫으면 시작일과 종료일이 같은 하루 일정이 된다.
 */
export function useDateRangeDraft(value: DateRange, onConfirm: (next: DateRange) => void) {
  const [session, setSession] = useState<Session | null>(null);

  return {
    isOpen: session != null,
    /** 다음 클릭이 채울 칸 — 입력 칸 강조에 쓴다 */
    activeEdge: session?.edge ?? null,
    anchorEdge: session?.anchor ?? null,
    /** 열려 있으면 임시 값, 닫혀 있으면 확정 값 */
    range: session?.range ?? value,
    open(edge: RangeEdge) {
      setSession((current) => {
        const range = current?.range ?? value;
        return { range, edge: edge === "end" && !range.start ? "start" : edge, anchor: edge };
      });
    },
    pick(ymd: string) {
      setSession((current) => current && { ...pickRangeDate(current.range, current.edge, ymd), anchor: current.anchor });
    },
    cancel() {
      setSession(null);
    },
    /** 고른 날짜가 있으면 반영하고 닫는다 (확인 버튼·바깥 클릭) */
    confirm() {
      if (session?.range.start) {
        const { start, end } = session.range;
        onConfirm({ start, end: end || start });
      }
      setSession(null);
    },
  };
}
