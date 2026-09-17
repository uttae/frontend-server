import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

// Run from the repository root: node scripts/generate-brand-icons.mjs
// Use --browser-only to refresh only browser-tab PNG/ICO assets.
const brandSource = await readFile("public/brand/Glyph_L.svg");
const faviconSource = await readFile("public/landing/figma/symbol.svg");
const outputs = [
  { path: "public/brand/Glyph.png", size: 1200, source: brandSource, sourceSize: 90, ratio: 1 },
  {
    path: "public/favicon/favicon-16x16.png",
    size: 16,
    source: faviconSource,
    sourceSize: 30,
    ratio: 7 / 8,
    browser: true,
  },
  {
    path: "public/favicon/favicon-32x32.png",
    size: 32,
    source: faviconSource,
    sourceSize: 30,
    ratio: 7 / 8,
    browser: true,
  },
  {
    path: "public/favicon/apple-touch-icon.png",
    size: 180,
    source: faviconSource,
    sourceSize: 30,
    ratio: 0.65,
  },
  {
    path: "public/favicon/android-chrome-192x192.png",
    size: 192,
    source: faviconSource,
    sourceSize: 30,
    ratio: 0.65,
  },
  {
    path: "public/favicon/android-chrome-512x512.png",
    size: 512,
    source: faviconSource,
    sourceSize: 30,
    ratio: 0.65,
  },
];

function render(source, sourceSize, size, ratio) {
  const contentSize = Math.round(size * ratio);
  const remaining = size - contentSize;
  const leading = Math.floor(remaining / 2);
  const trailing = remaining - leading;

  return sharp(source, { density: 72 * size / sourceSize })
    .resize(contentSize, contentSize, { fit: "fill" })
    .extend({
      top: leading,
      bottom: trailing,
      left: leading,
      right: trailing,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
}

const browserOnly = process.argv.includes("--browser-only");
for (const output of outputs) {
  if (browserOnly && !output.browser) continue;

  await writeFile(
    output.path,
    await render(output.source, output.sourceSize, output.size, output.ratio).png().toBuffer(),
  );
}

async function renderIcoFrame(size) {
  const { data } = await render(faviconSource, 30, size, 7 / 8)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  // ICO DIB height includes the color bitmap and the transparency mask.
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sourceOffset = (y * size + x) * 4;
      const targetOffset = ((size - 1 - y) * size + x) * 4;
      pixels[targetOffset] = data[sourceOffset + 2];
      pixels[targetOffset + 1] = data[sourceOffset + 1];
      pixels[targetOffset + 2] = data[sourceOffset];
      pixels[targetOffset + 3] = data[sourceOffset + 3];
    }
  }

  const maskRowBytes = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRowBytes * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = data[(y * size + x) * 4 + 3];
      if (alpha < 128) {
        const row = (size - 1 - y) * maskRowBytes;
        mask[row + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }
    }
  }

  return Buffer.concat([header, pixels, mask]);
}

// ICO directory with transparent 32bpp DIB frames for broad browser support.
const sizes = [16, 32, 48];
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
const frames = [];
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const frame = await renderIcoFrame(size);
  const entry = 6 + index * 16;
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  frames.push(frame);
  offset += frame.length;
}
await writeFile("public/favicon/favicon.ico", Buffer.concat([directory, ...frames]));
