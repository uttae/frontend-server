import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "@/components/BrandLogo";
import { brandAssets, faviconAssets } from "@/lib/public-assets";

const asset = (url: string) => readFileSync(resolve(process.cwd(), `public${url}`));
const pngs = [
  ["/brand/Glyph.png", 1200],
  ["/favicon/favicon-16x16.png", 16],
  ["/favicon/favicon-32x32.png", 32],
  ["/favicon/apple-touch-icon.png", 180],
  ["/favicon/android-chrome-192x192.png", 192],
  ["/favicon/android-chrome-512x512.png", 512],
] as const;

async function expectGlyph(bytes: Buffer, size: number) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([size, size, 4]);
  let transparent = 0;
  let blue = 0;
  let wrongColor = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) transparent++;
    if (data[offset + 3] === 255) {
      if (data[offset] !== 0 || data[offset + 1] !== 153 || data[offset + 2] !== 255) wrongColor++;
      blue++;
    }
  }
  expect(wrongColor).toBe(0);
  expect(transparent).toBeGreaterThan(size * size * 0.3);
  expect(blue).toBeGreaterThan(size * size * 0.2);
  // Compare decoded pixels against the unchanged official source, independently of the export script.
  const original = await sharp(asset("/brand/Glyph_L.svg"), { density: 72 * size / 90 })
    .resize(size, size).ensureAlpha().raw().toBuffer();
  expect(data.equals(original)).toBe(true);
}

describe("official blue glyph assets", () => {
  it.each([["S", 23], ["M", 45], ["L", 90]] as const)(
    "renders symbol %s with the original glyph proportions and accessible name",
    (size, dimension) => {
      const html = renderToStaticMarkup(<BrandLogo variant="symbol" size={size} />);
      expect(html).toContain(`src="/brand/Glyph_${size}.svg"`);
      expect(html).toContain(`width="${dimension}" height="${dimension}"`);
      expect(html).toContain('alt="우때 로고"');
    },
  );

  it.each(pngs)("exports %s as a transparent, shape-preserving blue PNG", async (url, size) => {
    expect((await sharp(asset(url)).metadata()).format).toBe("png");
    await expectGlyph(asset(url), size);
  });

  it("ships decodable transparent ICO frames at 16, 32 and 48 pixels", async () => {
    const ico = asset(faviconAssets.ico);
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16;
      expect([...ico.subarray(entry, entry + 4)]).toEqual([size, size, 0, 0]);
      expect(ico.readUInt16LE(entry + 4)).toBe(1);
      expect(ico.readUInt16LE(entry + 6)).toBe(32);
      const length = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(offset + length).toBeLessThanOrEqual(ico.length);
      await expectGlyph(ico.subarray(offset, offset + length), size);
    }
  });

  it("keeps manifest dimensions, colors and public asset links consistent", async () => {
    const manifest = JSON.parse(asset(faviconAssets.manifest).toString());
    expect(manifest.theme_color).toBe("#0099FF");
    expect(manifest.background_color).toBe("#ffffff");
    expect(manifest.icons).toHaveLength(2);
    for (const icon of manifest.icons) {
      const image = await sharp(asset(icon.src)).metadata();
      expect(icon.sizes).toBe(`${image.width}x${image.height}`);
      expect(icon.type).toBe(`image/${image.format}`);
      expect(image.hasAlpha).toBe(true);
      expect(icon.purpose ?? "any").toBe("any");
    }
    for (const url of [brandAssets.shareImage, ...Object.values(faviconAssets)]) {
      expect(asset(url).length).toBeGreaterThan(0);
    }
  });
});
