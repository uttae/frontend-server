import type { ImgHTMLAttributes } from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & {
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    const { priority, unoptimized, ...imageProps } = props;
    void priority;
    void unoptimized;

    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- alt is forwarded via imageProps spread
    return <img {...imageProps} />;
  },
}));

import { LandingView } from "@/app/_components/LandingView";

describe("LandingView", () => {
  it("renders the final Figma A+C wording and section order in server HTML", () => {
    const html = renderToStaticMarkup(<LandingView />);
    const story = [
      "올인원 해외여행", "여행을 계획할 때마다", "복잡한 여행 계획은",
      "장소를 검색하고", "저장한 장소로", "친구와 함께 계획하고",
      "여행 계획은 PC에서 편리하게", "이렇게 완성하세요!", "우리 함께할 때",
    ];
    let previous = -1;
    for (const copy of story) {
      const position = html.indexOf(copy);
      expect(position, copy).toBeGreaterThan(previous);
      previous = position;
    }
    expect(html).toContain('id="features"');
    expect(html).toContain('id="how-it-works"');
    expect(html.match(/<a\b[^>]*href="\/login"[^>]*>여행 시작하기/g)).toHaveLength(2);
    expect(html).not.toContain("가입 없이 시작하기");
    expect(html).not.toMatch(/흩어진 여행 계획을|REAL-TIME TRAVEL PLANNER|Co-founder/);
    expect(html).not.toContain('href="/product"');
    expect(html).not.toContain("opacity:0");
  });

  it("preserves login, navigation and legal destinations without fake device UI", () => {
    const html = renderToStaticMarkup(<LandingView />);
    expect(html.match(/href="\/login"/g)).toHaveLength(3);
    for (const href of ["/#features", "/#how-it-works", "/terms", "/privacy", "/operations-policy", "/copyright-policy"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain('href="mailto:contact@uttae.app"');
    expect(html).not.toMatch(/9:41|Status Bar|Home Indicator|Dynamic Island/);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("ships every rendered illustration locally as nonempty image bytes", () => {
    const html = renderToStaticMarkup(<LandingView />);
    const sources = [
      ...[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]),
      ...[...html.matchAll(/<source[^>]+srcset="([^"]+)"/gi)].map((match) => match[1]),
    ];
    expect(sources.length).toBeGreaterThan(20);
    for (const src of sources) {
      expect(src).toMatch(/^\/landing\/figma\//);
      const path = join(process.cwd(), "public", src);
      expect(existsSync(path), src).toBe(true);
      const bytes = readFileSync(path);
      expect(bytes.length, src).toBeGreaterThan(100);
      if (src.endsWith(".png")) {
        expect(bytes.subarray(0, 8).toString("hex"), src).toBe("89504e470d0a1a0a");
      } else {
        expect(bytes.toString(), src).toContain("<svg");
      }
    }
  });

  it("sizes only the four travel PNGs for their responsive artwork widths", () => {
    const html = renderToStaticMarkup(<LandingView />);
    const expected = {
      passport: "(min-width: 1440px) 241.36px, (min-width: 720px) 16.76132vw, (max-width: 392px) 104.55px, 122.99px",
      map: "(min-width: 1440px) 260px, (min-width: 720px) 18.05556vw, (max-width: 392px) 122.93px, 144.62px",
      calendar: "(min-width: 1440px) 229.44px, (min-width: 720px) 15.93362vw, (max-width: 392px) 105.52px, 124.14px",
      globe: "(min-width: 1440px) 262.53px, (min-width: 720px) 18.23097vw, (max-width: 392px) 122.2px, 143.77px",
    };
    for (const [name, sizes] of Object.entries(expected)) {
      const images = html.match(new RegExp(`<img[^>]+src="/landing/figma/${name}\\.png"[^>]*>`, "g"));
      expect(images, name).toHaveLength(1);
      expect(images![0], name).toContain(`sizes="${sizes}"`);
      expect(images![0], name).toContain('width="1536" height="1536"');
    }
    // Every other consumer must retain the existing mobile/full intrinsic-width hint.
    const otherImages = [...html.matchAll(/<img[^>]+>/g)]
      .map(([tag]) => tag)
      .filter((tag) => !/\/(passport|map|calendar|globe)\.png"/.test(tag));
    expect(otherImages.length).toBeGreaterThan(20);
    for (const tag of otherImages) {
      expect(tag).toMatch(/sizes="\(max-width: 719px\) 100vw, [\d.]+px"/);
    }
  });
});
