// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MapDiscoverToolbar } from "./MapDiscoverToolbar";
import { MapToolbarLayoutProvider } from "@/contexts/MapToolbarLayoutContext";
import type { OpenValue, RatingValue } from "./map-filters";
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: false }) }));
let root: Root, host: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); });
it("keeps the selected category, applies rating/open filters, and reset clears all filters", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  function App() {
    const [category, setCategory] = useState<string | null>(null);
    const [rating, setRating] = useState<RatingValue>("all");
    const [open, setOpen] = useState<OpenValue>("all");
    return <MapToolbarLayoutProvider setToolbarRef={() => {}}>
      <MapDiscoverToolbar selectedCategoryId={category} onSelectCategory={setCategory} rating={rating}
        setRating={setRating} openNow={open} setOpenNow={setOpen}/>
      <output>{JSON.stringify({ category, rating, open })}</output>
    </MapToolbarLayoutProvider>;
  }
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<App/>));
  const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === text)!;
  await act(async () => button("음식점").click());
  expect(button("음식점").getAttribute("aria-pressed")).toBe("true");
  expect(host.textContent).not.toContain("호텔");
  await act(async () => button("영업 중").click());
  // 평점 필터는 ui Select(Base UI)라 트리거는 combobox, 목록은 document.body로 포털된 listbox·option이다
  const trigger = host.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="평점 필터"]')!;
  expect(trigger.textContent).toBe("평점");
  await act(async () => trigger.click());
  await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const listbox = document.getElementById(trigger.getAttribute("aria-controls")!)!;
  expect(listbox.getAttribute("role")).toBe("listbox");
  expect(host.contains(listbox)).toBe(false);
  expect(document.activeElement?.getAttribute("role")).toBe("option");
  expect(document.activeElement?.textContent).toBe("전체");
  expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
  // The list is portalled out of the horizontal scroll clip, but its choices must still work.
  const ratingChoice = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].find(o => o.textContent === "4.0 이상")!;
  await act(async () => ratingChoice.click());
  expect(JSON.parse(host.querySelector("output")!.textContent!)).toEqual({ category: "restaurant", rating: "4.0", open: "open" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.textContent).toBe("4.0 이상");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="카테고리 필터 초기화"]')!.click());
  expect(JSON.parse(host.querySelector("output")!.textContent!)).toEqual({ category: null, rating: "all", open: "all" });
  expect(host.querySelector('[aria-label="평점 필터"]')).toBeNull();
  expect(button("호텔")).toBeDefined();
});
