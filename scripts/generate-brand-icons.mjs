import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

// Run from the repository root: node scripts/generate-brand-icons.mjs
// Preserve the official SVG paths, #0099FF fill and transparent background.
const source = await readFile("public/brand/Glyph_L.svg");
const outputs = [
  ["public/brand/Glyph.png", 1200],
  ["public/favicon/favicon-16x16.png", 16],
  ["public/favicon/favicon-32x32.png", 32],
  ["public/favicon/apple-touch-icon.png", 180],
  ["public/favicon/android-chrome-192x192.png", 192],
  ["public/favicon/android-chrome-512x512.png", 512],
];

function renderPng(size) {
  // Rasterize at the target resolution instead of enlarging a 90px bitmap.
  return sharp(source, { density: 72 * size / 90 })
    .resize(size, size)
    .png()
    .toBuffer();
}

for (const [path, size] of outputs) {
  await writeFile(path, await renderPng(size));
}

// ICO directory with lossless RGBA PNG frames, supported by modern browsers.
const sizes = [16, 32, 48];
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
const frames = [];
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const png = await renderPng(size);
  const entry = 6 + index * 16;
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  frames.push(png);
  offset += png.length;
}
await writeFile("public/favicon/favicon.ico", Buffer.concat([directory, ...frames]));
