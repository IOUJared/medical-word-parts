import { defineConfig, globalIgnores } from "eslint/config";
import nextTypescript from "eslint-config-next/typescript";
import nextWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([
    "node_modules/",
    ".next/",
    "out/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    ".wrangler/",
    "public/generated/",
  ]),
]);
