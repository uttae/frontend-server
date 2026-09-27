// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { HOME_BANNERS, HomeBannerCarousel, type HomeBanner } from "./HomeBannerCarousel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const banners: HomeBanner[] = [
  { id: "first", href: "https://example.com/first", label: "첫 이벤트", content: <span>첫 배너</span> },
  { id: "second", href: "https://example.com/second", label: "둘째 이벤트", content: <span>둘째 배너</span> },
];

it("shows a single banner without navigation controls", async () => {
  await act(async () => root.render(<HomeBannerCarousel banners={banners.slice(0, 1)} />));

  const link = host.querySelector<HTMLAnchorElement>("a");
  expect(link?.href).toBe("https://example.com/first");
  expect(link?.target).toBe("_blank");
  expect(link?.rel).toContain("noopener");
  expect(host.textContent).toContain("첫 배너");
  expect(host.querySelector("button")).toBeNull();
});

it("switches between banners when more than one is registered", async () => {
  await act(async () => root.render(<HomeBannerCarousel banners={banners} />));

  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="다음 배너"]')?.click());
  expect(host.querySelector<HTMLAnchorElement>("a")?.href).toBe("https://example.com/second");
  expect(host.textContent).toContain("둘째 배너");

  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="다음 배너"]')?.click());
  expect(host.querySelector<HTMLAnchorElement>("a")?.href).toBe("https://example.com/first");
});

it("loads each feedback artwork asset only once", async () => {
  await act(async () => root.render(<HomeBannerCarousel banners={HOME_BANNERS} />));

  expect(host.querySelectorAll("img")).toHaveLength(2);
});
