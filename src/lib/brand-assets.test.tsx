import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "@/components/BrandLogo";
import { brandAssets, faviconAssets } from "@/lib/public-assets";

const asset = (url: string) => readFileSync(resolve(process.cwd(), `public${url}`));

/**
 * 파비콘과 랜딩 Figma 내보내기가 공유하는 브랜드 블루.
 * `/brand/*.svg`와 site.webmanifest는 아직 이전 값(#0099FF)이라 여기서 강제하지 않는다.
 */
const BRAND_BLUE = [1, 131, 255] as const;

/**
 * 캔버스 대비 글리프가 차지하는 비율. 가장자리까지 꽉 채우면 iOS 라운드 마스크와
 * PWA maskable 안전 영역에서 잘리므로 상한을 둔다.
 */
const CONTENT_RATIO = { min: 0.6, max: 0.78 };

/** 좌우/상하 여백 차이 허용치 — 글리프가 캔버스 중앙에서 크게 밀리지 않도록 한다. */
const CENTERING_TOLERANCE = 0.07;

const faviconPngs = [
  [faviconAssets.icon16, 16],
  [faviconAssets.icon32, 32],
  [faviconAssets.appleTouchIcon, 180],
  ["/favicon/android-chrome-192x192.png", 192],
  ["/favicon/android-chrome-512x512.png", 512],
] as const;

/** ICO의 32bpp 무압축 DIB 프레임을 위에서 아래로 읽은 RGBA 버퍼로 바꾼다. */
function decodeIcoFrame(frame: Buffer) {
  const headerSize = frame.readUInt32LE(0);
  const width = frame.readInt32LE(4);
  // XOR 픽셀과 AND 마스크가 함께 담겨 높이가 2배로 기록된다.
  const height = frame.readInt32LE(8) / 2;

  expect(frame.readUInt16LE(14)).toBe(32);
  expect(frame.readUInt32LE(16)).toBe(0); // BI_RGB, 무압축

  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    // DIB는 상하가 뒤집힌 채로, 채널은 BGRA 순서로 저장된다.
    const row = headerSize + (height - 1 - y) * width * 4;
    for (let x = 0; x < width; x++) {
      const from = row + x * 4;
      const to = (y * width + x) * 4;
      data[to] = frame[from + 2];
      data[to + 1] = frame[from + 1];
      data[to + 2] = frame[from];
      data[to + 3] = frame[from + 3];
    }
  }

  return { data, width, height };
}

/** 알파가 있는 픽셀의 경계 상자 — 캔버스 대비 글리프의 크기와 치우침을 잰다. */
function contentBounds(data: Buffer, size: number) {
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    width: (maxX - minX + 1) / size,
    height: (maxY - minY + 1) / size,
    horizontalDrift: Math.abs(minX - (size - 1 - maxX)) / size,
    verticalDrift: Math.abs(minY - (size - 1 - maxY)) / size,
  };
}

/**
 * 투명 배경 위에 단색 브랜드 블루 글리프가, 안전 여백을 두고 중앙에 놓였는지 검사한다.
 * 픽셀 단위 원본 대조 대신 이 계약만 확인해 내보내기 도구 교체를 허용한다.
 */
function expectBrandGlyph(data: Buffer, size: number) {
  let transparent = 0;
  let opaque = 0;
  let pureBlue = 0;
  let foreignColor = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const alpha = data[offset + 3];

      if (alpha === 0) transparent++;
      if (alpha === 255) {
        opaque++;
        const [red, green, blue] = [data[offset], data[offset + 1], data[offset + 2]];

        if (red === BRAND_BLUE[0] && green === BRAND_BLUE[1] && blue === BRAND_BLUE[2]) {
          pureBlue++;
        } else {
          // 내보내기 도구가 가장자리를 흰색 위에 합성해 불투명하게 남긴다.
          // 브랜드 블루와 흰색 사이의 혼합만 허용하고, 다른 색조는 실패로 본다.
          const ratio = (red - BRAND_BLUE[0]) / (255 - BRAND_BLUE[0]);
          const blendedGreen = BRAND_BLUE[1] + ratio * (255 - BRAND_BLUE[1]);
          // 파랑 채널은 브랜드 블루와 흰색 모두 255라 리샘플링 반올림만 흔들린다.
          if (blue < 253 || ratio < -0.02 || Math.abs(green - blendedGreen) > 3) {
            foreignColor++;
          }
        }
      }
    }
  }

  expect(foreignColor).toBe(0);
  // 가장자리 혼합을 빼면 글리프 본체는 단색 브랜드 블루여야 한다.
  expect(pureBlue / opaque).toBeGreaterThan(0.9);
  expect(opaque).toBeGreaterThan(size * size * 0.05);
  expect(transparent).toBeGreaterThan(size * size * 0.4);

  const bounds = contentBounds(data, size);
  for (const ratio of [bounds.width, bounds.height]) {
    expect(ratio).toBeGreaterThanOrEqual(CONTENT_RATIO.min);
    expect(ratio).toBeLessThanOrEqual(CONTENT_RATIO.max);
  }
  expect(bounds.horizontalDrift).toBeLessThanOrEqual(CENTERING_TOLERANCE);
  expect(bounds.verticalDrift).toBeLessThanOrEqual(CENTERING_TOLERANCE);
}

async function expectGlyphPng(bytes: Buffer, size: number) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  expect([info.width, info.height, info.channels]).toEqual([size, size, 4]);
  expectBrandGlyph(data, size);
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

  it.each(faviconPngs)("exports %s as a transparent, safely inset blue PNG", async (url, size) => {
    expect((await sharp(asset(url)).metadata()).format).toBe("png");
    await expectGlyphPng(asset(url), size);
  });

  it("keeps a single glyph scale across every favicon size", async () => {
    const ratios = await Promise.all(
      faviconPngs.map(async ([url, size]) => {
        const data = await sharp(asset(url)).ensureAlpha().raw().toBuffer();
        return contentBounds(data, size).width;
      }),
    );

    // 사이즈마다 따로 만든 게 아니라 같은 규칙으로 뽑혔는지 — 반올림 오차 범위만 허용.
    for (const ratio of ratios) {
      expect(ratio).toBeCloseTo(ratios[0], 1);
    }
  });

  it("ships decodable transparent ICO frames at 16, 32 and 48 pixels", () => {
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

      const frame = decodeIcoFrame(ico.subarray(offset, offset + length));
      expect([frame.width, frame.height]).toEqual([size, size]);
      expectBrandGlyph(frame.data, size);
    }
  });

  it("keeps manifest dimensions, colors and public asset links consistent", async () => {
    const manifest = JSON.parse(asset(faviconAssets.manifest).toString());
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
