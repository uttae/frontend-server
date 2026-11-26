import { fileURLToPath } from "node:url";

import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
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
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8080",
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test-google-client-id",
      NEXT_PUBLIC_GOOGLE_REDIRECT_URI: "http://localhost:3000/auth/callback",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test-google-maps-api-key",
    },
  },
});
