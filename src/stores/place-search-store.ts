import { create } from "zustand";
import type { SearchRankBucket } from "@/lib/analytics/context";
import type { PlaceSearchResult } from "@/hooks/usePlacesSearch";

type PlaceSearchState = {
  scope: string;
  generation: number;
  query: string;
  confirmationKind: "whole" | "specific" | null;
  items: PlaceSearchResult[];
  /** Coarse original Text Search rank, independent of retained recommendation/display order. */
  searchRankBuckets: Readonly<Record<string, SearchRankBucket>>;
  selectedId: string | null;
  expanded: boolean;
  status: "idle" | "pending" | "done" | "error";
  error: string | null;
  fallback: boolean;
  termination: "completed" | "failed" | "not-requested";
  setScope: (scope: string) => void;
  invalidate: () => number;
  select: (id: string) => void;
  setExpanded: (expanded: boolean) => void;
  clear: () => void;
};
const empty = {
  query: "",
  confirmationKind: null,
  items: [],
  searchRankBuckets: {},
  selectedId: null,
  expanded: false,
  status: "idle" as const,
  error: null,
  fallback: false,
  termination: "not-requested" as const,
};
export const usePlaceSearchStore = create<PlaceSearchState>((set, get) => ({
  ...empty,
  scope: "",
  generation: 0,
  setScope: (scope) => {
    if (get().scope !== scope)
      set({ ...empty, scope, generation: get().generation + 1 });
  },
  invalidate: () => {
    const generation = get().generation + 1;
    set({
      generation,
      status: get().items.length ? "done" : "idle",
      error: null,
    });
    return generation;
  },
  select: (selectedId) =>
    set({
      selectedId,
      generation: get().generation + 1,
      status: get().items.length ? "done" : "idle",
    }),
  setExpanded: (expanded) => set({ expanded }),
  clear: () => set({ ...empty, generation: get().generation + 1 }),
}));
