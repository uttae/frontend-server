import { create } from "zustand";
import type { PlaceResolveResponse } from "@/lib/api/place-sessions";
import type { SearchRankBucket } from "@/lib/analytics/context";
import type { PlaceSearchResult } from "@/hooks/usePlacesSearch";

/** 검색창에서 찾기(text) / 「현 위치에서 검색」 버튼(map_recenter) */
export type PlaceSearchMode = "text" | "map_recenter";

type PlaceSearchState = {
  scope: string;
  generation: number;
  query: string;
  confirmationKind: "whole" | "specific" | null;
  /** 이 검색을 시작한 곳. 「현 위치에서 검색」의 실패·결과 없음은 검색창이 아니라 그 버튼 자리에서 알린다 */
  searchMode: PlaceSearchMode;
  items: PlaceSearchResult[];
  /** Coarse original Text Search rank, independent of retained recommendation/display order. */
  searchRankBuckets: Readonly<Record<string, SearchRankBucket>>;
  selectedId: string | null;
  expanded: boolean;
  status: "idle" | "pending" | "done" | "error";
  error: string | null;
  termination: PlaceResolveResponse["termination"] | "failed" | "not-requested";
  resolution: Omit<PlaceResolveResponse, "detail"> | null;
  setScope: (scope: string) => void;
  invalidate: () => number;
  select: (id: string | null) => void;
  setExpanded: (expanded: boolean) => void;
  clear: () => void;
};
const empty = {
  query: "",
  confirmationKind: null,
  searchMode: "text" as const,
  items: [],
  searchRankBuckets: {},
  selectedId: null,
  expanded: false,
  status: "idle" as const,
  error: null,
  termination: "not-requested" as const,
  resolution: null,
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
