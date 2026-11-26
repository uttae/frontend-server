import { create } from "zustand";

export type MapPinsFocus = "search" | "discover" | null;

type MapPinsFocusState = {
  focus: MapPinsFocus;
  writeEpoch: number;
  claimFocus: (next: "search" | "discover") => number;
  releaseSearchFocusIfActive: () => void;
  releaseFocus: () => void;
};

export const useMapPinsFocusStore = create<MapPinsFocusState>((set, get) => ({
  focus: null,
  writeEpoch: 0,

  claimFocus: (next) => {
    const writeEpoch = get().writeEpoch + 1;
    set({ focus: next, writeEpoch });
    return writeEpoch;
  },

  releaseSearchFocusIfActive: () => {
    if (get().focus !== "search") return;
    const writeEpoch = get().writeEpoch + 1;
    set({ focus: null, writeEpoch });
  },

  releaseFocus: () => {
    const writeEpoch = get().writeEpoch + 1;
    set({ focus: null, writeEpoch });
  },
}));

export function discoverPinWriteStillValid(epoch: number): boolean {
  const { focus, writeEpoch } = useMapPinsFocusStore.getState();
  return focus === "discover" && writeEpoch === epoch;
}

export function searchPinWriteStillValid(epoch: number): boolean {
  const { focus, writeEpoch } = useMapPinsFocusStore.getState();
  return focus === "search" && writeEpoch === epoch;
}
