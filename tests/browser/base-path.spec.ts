import { expect, test } from "@playwright/test";

const configuredUrl = process.env["OPENWORD_TEST_BASE_URL"] ?? "http://127.0.0.1:4173/medical-word-parts";
const baseUrl = configuredUrl.replace(/\/$/, "");
const basePath = new URL(baseUrl).pathname.replace(/\/$/, "");

function appUrl(path: string): string {
  return `${baseUrl}${path}`;
}

test("home routing and all local enhancer scripts use the active server-rendered base path", async ({ page }) => {
  const cases = [
    { input: "adrenal", destination: `${basePath}/term/adrenal/` },
    { input: "hypoglycaemia", destination: `${basePath}/term/hypoglycemia/` },
    { input: "hypo nephritis", destination: `${basePath}/analyze/?term=hypo+nephritis` },
  ] as const;
  for (const fixture of cases) {
    await page.goto(appUrl("/"), { waitUntil: "networkidle" });
    await page.getByRole("combobox", { name: "Medical term" }).fill(fixture.input);
    await page.getByRole("combobox", { name: "Medical term" }).press("Enter");

    await expect(page).toHaveURL(new URL(fixture.destination, page.url()).toString());
  }

  const scripts = [
    { path: "/", source: `${basePath}/generated/theme.js` },
    { path: "/", source: `${basePath}/generated/site.js` },
    { path: "/analyze/?term=adrenal", source: `${basePath}/generated/analyzer.js` },
    { path: "/parts/", source: `${basePath}/generated/parts.js` },
  ] as const;
  for (const fixture of scripts) {
    await page.goto(appUrl(fixture.path), { waitUntil: "networkidle" });
    await expect(page.locator(`script[src='${fixture.source}']`)).toHaveCount(1);
  }
});

test("masthead search access uses Next base-path navigation", async ({ page }) => {
  await page.goto(appUrl("/term/adrenal/"), { waitUntil: "networkidle" });
  const searchLink = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Search" });

  await expect(searchLink).toHaveAttribute("href", `${basePath}/analyze/`);
  await searchLink.click();

  await expect(page).toHaveURL(appUrl("/analyze/"));
});

test("analyzer morphology, correction, parts links, and parts history preserve the active base path", async ({ page }) => {
  await page.goto(appUrl("/analyze/?term=adrenal"), { waitUntil: "networkidle" });
  await expect(page.locator(".morphology a").first()).toHaveAttribute("href", new RegExp(`^${basePath}/parts/`));
  await expect(page.getByRole("link", { name: /Propose a correction on GitHub/ })).toHaveAttribute("href", /^https:\/\/github\.com\//);

  await page.goto(appUrl("/parts/?kind=prefix"), { waitUntil: "networkidle" });
  await expect(page.locator(".part-list a").first()).toHaveAttribute("href", new RegExp(`^${basePath}/parts/`));
  await page.getByRole("checkbox", { name: "Suffix" }).check();
  await expect(page).toHaveURL(/kind=prefix&kind=suffix$/);
  await page.evaluate(() => {
    window.history.pushState(null, "", "?kind=suffix");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("checkbox", { name: "Suffix" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Prefix" })).not.toBeChecked();
});

test("the development-only component showcase is absent from the production export", async ({ page }) => {
  const response = await page.goto(appUrl("/component-showcase/"), { waitUntil: "load" });

  expect(response?.status()).toBe(404);
});

test("production enhancer routes remain free of console, page, and hydration errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));

  for (const path of ["/", "/analyze/?term=adrenal", "/parts/?kind=prefix"] as const) {
    await page.goto(appUrl(path), { waitUntil: "networkidle" });
  }

  expect({ consoleErrors, pageErrors }).toEqual({ consoleErrors: [], pageErrors: [] });
});
