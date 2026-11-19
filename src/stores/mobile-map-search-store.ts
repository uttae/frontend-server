import { create } from "zustand";

type MobileMapSearchState = {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  focusInput: (() => void) | null;
  setFocusInput: (fn: (() => void) | null) => void;
  textQuery: string;
  textSearchNonce: number;
  submitTextSearch: (query: string) => void;
  clearTextSearch: () => void;
};

export const useMobileMapSearchStore = create<MobileMapSearchState>((set) => ({
  open: false,
  openSearch: () => set({ open: true }),
  closeSearch: () => set({ open: false }),
  focusInput: null,
  setFocusInput: (focusInput) => set({ focusInput }),
  textQuery: "",
  textSearchNonce: 0,
  submitTextSearch: (query) =>
    set((s) => ({ textQuery: query.trim(), textSearchNonce: s.textSearchNonce + 1 })),
  clearTextSearch: () =>
    set((s) => ({ textQuery: "", textSearchNonce: s.textSearchNonce + 1 })),
}));
