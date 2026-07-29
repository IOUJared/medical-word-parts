import { expect, test, type Page } from "@playwright/test";

import { corpus } from "../../src/generated/corpus";

const repetitionCount = 10;
const prefixCount = corpus.parts.filter((part) => part.kind === "prefix").length;

type BrowserErrors = {
  readonly console: string[];
  readonly page: string[];
};

function captureErrors(page: Page): BrowserErrors {
  const errors: BrowserErrors = { console: [], page: [] };
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("pageerror", (error) => errors.page.push(error.stack ?? error.message));
  return errors;
}

async function proveNoLaterReplacement(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.readyState)).toBe("complete");
  await page.waitForTimeout(750);
}

test("analyzer enhancement survives final root development hydration on every repeated load", async ({ context }) => {
  for (let iteration = 0; iteration < repetitionCount; iteration += 1) {
    const page = await context.newPage();
    const errors = captureErrors(page);
    await page.goto("/analyze/?term=adrenal", { waitUntil: "load" });
    await proveNoLaterReplacement(page);

    const state = await page.evaluate(() => ({
      input: document.querySelector<HTMLInputElement>("#analyzer-term")?.value,
      status: document.querySelector<HTMLElement>("[data-result-status]")?.dataset["resultStatus"],
      scripts: document.querySelectorAll("script[src='/generated/analyzer.js']").length,
    }));
    expect({ errors, state }).toEqual({
      errors: { console: [], page: [] },
      state: { input: "adrenal", status: "verified", scripts: 1 },
    });
    await page.close();
  }

  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto("/analyze/?term=adrenal", { waitUntil: "load" });
  await proveNoLaterReplacement(page);
  const input = page.getByRole("searchbox", { name: "Medical term" });
  await input.fill("hyponephritis");
  await input.press("Enter");
  await expect(page).toHaveURL(/term=hyponephritis$/);
  await expect(page.locator("[data-result-status='derived']")).toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue("adrenal");
  await expect(page.locator("[data-result-status='verified']")).toBeVisible();
  expect(errors).toEqual({ console: [], page: [] });
  await page.close();
});

test("parts enhancement survives final root development hydration on every repeated load", async ({ context }) => {
  for (let iteration = 0; iteration < repetitionCount; iteration += 1) {
    const page = await context.newPage();
    const errors = captureErrors(page);
    await page.goto("/parts/?kind=prefix", { waitUntil: "load" });
    await proveNoLaterReplacement(page);

    const state = await page.evaluate(() => ({
      checked: document.querySelector<HTMLInputElement>("[data-part-kind][value='prefix']")?.checked,
      count: document.querySelector<HTMLElement>("[data-part-count]")?.textContent,
      scripts: document.querySelectorAll("script[src='/generated/parts.js']").length,
    }));
    expect({ errors, state }).toEqual({
      errors: { console: [], page: [] },
      state: { checked: true, count: String(prefixCount), scripts: 1 },
    });
    await page.close();
  }

  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto("/parts/?kind=prefix", { waitUntil: "load" });
  await proveNoLaterReplacement(page);
  await page.getByRole("checkbox", { name: "Suffix" }).check();
  await expect(page).toHaveURL(/kind=prefix&kind=suffix$/);
  await page.goto("/parts/?kind=suffix", { waitUntil: "load" });
  await proveNoLaterReplacement(page);
  await expect(page.getByRole("checkbox", { name: "Suffix" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Prefix" })).not.toBeChecked();
  await page.goBack();
  await proveNoLaterReplacement(page);
  await expect(page.getByRole("checkbox", { name: "Prefix" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Suffix" })).toBeChecked();
  expect(errors).toEqual({ console: [], page: [] });
  await page.close();
});

test("root development stays mounted at the local origin", async ({ page }) => {
  const errors = captureErrors(page);

  await page.goto("/", { waitUntil: "load" });
  await proveNoLaterReplacement(page);

  await expect(page).toHaveURL("http://127.0.0.1:3010/");
  await expect(page.locator("head > script[src='/generated/theme.js']")).toHaveCount(1);
  expect(await page.locator("head > script[src='/generated/theme.js']").evaluate((script) => Object.fromEntries([...script.attributes].map((attribute) => [attribute.name, attribute.value])))).toEqual({ src: "/generated/theme.js" });
  await expect(page.locator("script[src='/generated/site.js']")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Dark mode" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Read the parts. Verify the construction." })).toBeVisible();
  expect(errors).toEqual({ console: [], page: [] });
});

test("default development tooling can coexist with the root site enhancer", async ({ page }) => {
  test.skip(process.env["OPENWORD_SMOKE_DEFAULT_DEV"] !== "1", "Run against a default development server");
  const errors = captureErrors(page);

  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("script[src='/generated/site.js']")).toHaveCount(1);
  await expect(page.locator("script[src*='react-grab']")).toHaveCount(1);
  await expect(page.locator("script[src*='react-scan']")).toHaveCount(1);
  await proveNoLaterReplacement(page);
  await expect(page.getByRole("heading", { level: 1, name: "Read the parts. Verify the construction." })).toBeVisible();
  expect(errors).toEqual({ console: [], page: [] });
});
