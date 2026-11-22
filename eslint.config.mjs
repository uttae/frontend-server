import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["tailwind.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": ["error", { allow: [String.raw`^\./src/lib/layout-tokens$`] }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".worktrees/**"]),
]);

export default eslintConfig;
