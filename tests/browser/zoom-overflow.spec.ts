import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:4173/medical-word-parts";

test("the Construction heading stays on one line at 200 percent zoom", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${baseUrl}/term/hypoglycemia/`, { waitUntil: "networkidle" });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });

  const lineCount = await page.getByRole("heading", { level: 2, name: "Construction" }).evaluate((heading) => {
    const range = document.createRange();
    range.selectNodeContents(heading);
    return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
  });

  expect(lineCount).toBe(1);
});

test("correction primary links stay within a 375px viewport at 200 percent zoom", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
  const page = await context.newPage();
  for (const path of ["/term/hypoglycemia/", "/term/adrenal/"] as const) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    const measurement = await page.getByRole("link", { name: /Propose a correction on GitHub/ }).evaluate((link) => {
      const bounds = link.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        left: bounds.left,
        right: bounds.right,
      };
    });

    expect(measurement.scrollWidth).toBe(measurement.clientWidth);
    expect(measurement.left).toBeGreaterThanOrEqual(0);
    expect(measurement.right).toBeLessThanOrEqual(measurement.clientWidth);
  }
  await context.close();
});
