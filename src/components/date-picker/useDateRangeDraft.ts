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
  picked: PickedRange;

  edge: RangeEdge;
};

export function useDateRangeDraft(value: DateRange, onConfirm: (next: DateRange) => void) {
  const [session, setSession] = useState<Session | null>(null);

  return {
    isOpen: session != null,

    activeEdge: session?.edge ?? null,

    range: session ? displayPickedRange(value, session.picked) : value,
    open(edge: RangeEdge) {
      setSession((current) => {
        const picked = current?.picked ?? {};
        const { start } = displayPickedRange(value, picked);
        return { picked, edge: edge === "end" && !start ? "start" : edge };
      });
    },
    pick(ymd: string) {
      setSession((current) => current && pickRangeDate(value, current.picked, current.edge, ymd));
    },
    cancel() {
      setSession(null);
    },

    confirm() {
      const next = session ? confirmPickedRange(value, session.picked) : null;
      if (next) onConfirm(next);
      setSession(null);
    },
  };
}
