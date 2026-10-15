// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SearchPage from "./page";
const state = vi.hoisted(() => ({
  mobile: false,
  params: new URLSearchParams("q=원래 검색어"),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => state.params,
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/contexts/MobileViewContext", () => ({
  useMobileView: () => ({ isMobileDevice: state.mobile }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it.each([false, true])(
  "keeps legacy query links by handing them to the common map search (mobile=%s)",
  async (mobile) => {
    state.mobile = mobile;
    state.replace.mockReset();
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<SearchPage />));
    expect(state.replace).toHaveBeenCalledWith(
      `${mobile ? "/map" : "/plan"}?q=${encodeURIComponent("원래 검색어")}`,
    );
    expect(host.textContent).toBe("");
    await act(async () => root.unmount());
  },
);
