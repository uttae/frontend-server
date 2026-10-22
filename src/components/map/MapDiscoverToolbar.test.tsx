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
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="평점 필터"]')!.click());
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="평점 필터"]')!;
  expect(document.getElementById(trigger.getAttribute("aria-controls")!)).not.toBeNull();
  expect(document.activeElement?.textContent).toBe("전체");
  // The menu is portalled out of the horizontal scroll clip, but its choices must still work.
  const ratingChoice = [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.includes("4.0"))!;
  await act(async () => {
    ratingChoice.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    ratingChoice.click();
  });
  expect(JSON.parse(host.querySelector("output")!.textContent!)).toMatchObject({ category: "restaurant", open: "open" });
  expect(JSON.parse(host.querySelector("output")!.textContent!).rating).not.toBe("all");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="카테고리 필터 초기화"]')!.click());
  expect(JSON.parse(host.querySelector("output")!.textContent!)).toEqual({ category: null, rating: "all", open: "all" });
  expect(button("호텔")).toBeDefined();
});
