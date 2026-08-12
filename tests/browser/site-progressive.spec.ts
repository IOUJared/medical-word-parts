import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:4173/medical-word-parts";

function appUrl(path: string): string {
  return `${baseUrl}${path}`;
}

test.describe.configure({ mode: "serial" });

test("the classic theme bootstrap and site enhancement are the only local scripts shared by static routes", async ({ page }) => {
  for (const path of ["/", "/404/", "/term/hypoglycemia/", "/parts/combining-glyc-o/"] as const) {
    await page.goto(appUrl(path), { waitUntil: "networkidle" });

    await expect(page.locator("script[src='/medical-word-parts/generated/theme.js']")).toHaveCount(1);
    await expect(page.locator("script[src='/medical-word-parts/generated/site.js']")).toHaveCount(1);
  }
});

test("canonical, alias, unknown, and markup-shaped searches navigate safely", async ({ page }) => {
  const cases = [
    { input: "adrenal", destination: /\/term\/adrenal\/$/ },
    { input: "hypoglycaemia", destination: /\/term\/hypoglycemia\/$/ },
    { input: "hypo nephritis", destination: /\/analyze\/\?term=hypo\+nephritis$/ },
    { input: "<img src=x onerror=alert(1)>", destination: /\/analyze\/\?term=%3Cimg\+src%3Dx\+onerror%3Dalert%281%29%3E$/ },
  ] as const;
  for (const fixture of cases) {
    await page.goto(appUrl("/"), { waitUntil: "networkidle" });
    const search = page.getByRole("combobox", { name: "Medical term" });
    await search.fill(fixture.input);
    await search.press("Enter");

    await expect(page).toHaveURL(fixture.destination);
    await expect(page.locator("img")).toHaveCount(0);
  }
});

test("search and correction server fallbacks remain complete without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(appUrl("/"), { waitUntil: "load" });

  await expect(page.getByRole("search")).toHaveAttribute("action", "/medical-word-parts/analyze/");
  await expect(page.getByRole("searchbox", { name: "Medical term" })).toHaveAttribute("name", "term");

  await page.goto(appUrl("/term/hypoglycemia/"), { waitUntil: "load" });
  await expect(page.getByRole("link", { name: /Propose a correction on GitHub/ })).toHaveAttribute("href", /github\.com\/IOUJared\/medical-word-parts\/issues\/new/);
  await page.getByText("Copyable fallback template").click();
  await expect(page.getByText(/Current analysis: hypo- \+ glyc\/o \+ -emia/)).toBeVisible();
  await context.close();
});

test("clipboard failure announces manual recovery and focuses the fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } });
  });
  await page.goto(appUrl("/term/hypoglycemia/"), { waitUntil: "networkidle" });
  await page.getByText("Copyable fallback template").click();
  await page.getByRole("button", { name: /Copy template/ }).click();

  await expect(page.getByText(/Copy failed/)).toBeVisible();
  await expect(page.locator("[data-correction-template]")).toBeFocused();
});

test("404 search recovery uses canonical site routing", async ({ page }) => {
  await page.goto(appUrl("/404/"), { waitUntil: "networkidle" });
  const search = page.getByRole("combobox", { name: "Medical term" });
  await search.fill("cytokine");
  await search.press("Enter");

  await expect(page).toHaveURL(/\/term\/cytokine\/$/);
});
