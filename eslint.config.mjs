import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["tailwind.config.js"],
    rules: {
      // CSS @config로 로드하는 기존 CommonJS 설정의 공유 토큰 import만 허용합니다.
      "@typescript-eslint/no-require-imports": [
        "error",
        { allow: ["^\\./src/lib/layout-tokens$"] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // git worktree 사본 — 각자의 .next 빌드 산출물까지 lint되는 것을 방지.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
