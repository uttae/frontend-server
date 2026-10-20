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
    // clientEnv는 import 시점에 필수 값을 검사한다 — vitest는 .env.local을 process.env로 읽지 않으므로 테스트용 값을 넣는다
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8080",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test-google-client-id",
      NEXT_PUBLIC_GOOGLE_REDIRECT_URI: "http://localhost:3000/auth/callback",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test-google-maps-api-key",
    },
  },
});
