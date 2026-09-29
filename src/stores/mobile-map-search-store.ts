import { create } from "zustand";

type MobileMapSearchState = {
  /** 모바일 지도 위 전체 화면 검색 */
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  /** 검색 화면이 입력창 focus 함수를 등록 — 탭 제스처 안에서 호출해야 iOS 키보드가 뜬다 */
  focusInput: (() => void) | null;
  setFocusInput: (fn: (() => void) | null) => void;
  /** 엔터로 확정한 텍스트 검색어 — 지도에 결과 핀을 띄운다. 빈 문자열이면 검색 없음 */
  textQuery: string;
  /** 같은 검색어를 다시 확정해도 재검색되도록 확정마다 증가 */
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
