import { fileURLToPath } from "node:url";

import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // next.config.ts의 turbopack SVGR 규칙과 맞춘다 — 아이콘 SVG를 React 컴포넌트로 import
    svgr({
      include: "src/assets/icons/*.svg",
      svgrOptions: { exportType: "default" },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
