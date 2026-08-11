import { expect, test, type Locator } from "@playwright/test";

import { appUrl } from "./fixtures";

async function textLineCount(locator: Locator, text: string): Promise<number> {
  return locator.evaluate((element, expectedText) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node !== null && !node.textContent?.includes(expectedText)) node = walker.nextNode();
    if (node === null) throw new TypeError(`Could not find ${expectedText} text node`);
    const range = document.createRange();
    range.selectNodeContents(node);
    return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
  }, text);
}

test("long verified terms do not leave a one-letter orphan on mobile", async ({ page }) => {
  const term = "dermatofibrosarcoma";
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(appUrl(`/term/${term}/`), { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1, name: term })).toBeVisible();
  expect(await textLineCount(page.getByRole("heading", { level: 1 }), term)).toBe(1);
  expect(await textLineCount(page.locator(".reconstruction"), term)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
