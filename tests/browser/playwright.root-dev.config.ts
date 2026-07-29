import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../dev-browser",
  testMatch: "root-dev.spec.ts",
  outputDir: "../../.artifacts/playwright-results/root-dev",
  reporter: [["line"]],
  timeout: 180_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3010",
    channel: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3010",
    env: {
      NEXT_PUBLIC_BASE_PATH: "",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3010",
      NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS: "1",
    },
    reuseExistingServer: false,
    timeout: 30_000,
    url: "http://127.0.0.1:3010/",
  },
});
