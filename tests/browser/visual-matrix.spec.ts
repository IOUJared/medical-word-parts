import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { appUrl, visualRoutes } from "./fixtures";

test.describe.configure({ mode: "serial" });

for (const theme of ["light", "dark"] as const) {
  for (const route of visualRoutes) {
    test(`${route.slug} loads a complete, accessible ${theme} document without failed assets or overflow`, async ({ page }) => {
      const failedAssets: string[] = [];
      const recordFailedAsset = (response: { readonly url: () => string; readonly status: () => number }) => {
        if (response.url().includes("/_next/") && response.status() >= 400) failedAssets.push(response.url());
      };
      page.on("response", recordFailedAsset);
      await page.addInitScript((choice) => localStorage.setItem("medical-word-parts:theme", choice), theme);
      const response = await page.goto(appUrl(route.path), { waitUntil: "networkidle" });

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", String(theme === "dark"));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await page.evaluate(() => {
        const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
      })).toEqual([]);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-atkinson-loaded").length > 0)).toBe(true);
      expect(await page.evaluate(() => document.fonts.status)).toBe("loaded");
      expect(failedAssets).toEqual([]);
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
      page.off("response", recordFailedAsset);
    });
  }
}

test("all route types render in both themes at required visual evidence widths", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext();
    await context.addInitScript((choice) => localStorage.setItem("medical-word-parts:theme", choice), theme);
    const page = await context.newPage();
    for (const width of [375, 768, 1280] as const) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of visualRoutes) {
        await page.goto(appUrl(route.path), { waitUntil: "networkidle" });
        await page.screenshot({ path: `.artifacts/visual-qa/${route.slug}-${theme}-${width}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
    }
    await context.close();
  }
});
