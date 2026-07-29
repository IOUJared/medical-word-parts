import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: ".artifacts/playwright-results",
  reporter: [["line"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://127.0.0.1:4173/medical-word-parts",
    channel: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run serve:static-test",
    reuseExistingServer: false,
    timeout: 30_000,
    url: "http://127.0.0.1:4173/medical-word-parts/",
  },
});
