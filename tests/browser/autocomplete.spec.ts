import { expect, test } from "@playwright/test";

const baseUrl = "http://127.0.0.1:4173/medical-word-parts";

function appUrl(path: string): string {
  return `${baseUrl}${path}`;
}

test("keyboard selection fills a verified suggestion before submission", async ({ page }) => {
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const search = page.getByRole("combobox", { name: "Medical term" });

  await search.fill("cardio");
  await expect(page.getByRole("listbox", { name: "Verified term suggestions" })).toBeVisible();
  await expect(page.getByRole("option", { name: "cardiology" })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");

  await expect(search).toHaveValue("cardiology");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/medical-word-parts\/$/);

  await search.press("Enter");
  await expect(page).toHaveURL(/\/term\/cardiology\/$/);
});

test("home suggestions stay inside a mobile viewport when the field is near the fold", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Medical term" }).fill("cardio");
  const panel = page.locator("[data-term-suggestion-panel]");
  await expect(panel).toBeVisible();

  await expect.poll(async () => {
    const bounds = await panel.boundingBox();
    return bounds !== null && bounds.y >= 0 && bounds.y + bounds.height <= 900;
  }).toBe(true);

  const submitBounds = await page.getByRole("button", { name: "Find term" }).boundingBox();
  const panelBounds = await panel.boundingBox();
  if (submitBounds === null || panelBounds === null) throw new TypeError("Expected visible autocomplete geometry");
  expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(submitBounds.y);
});

test("pointer selection fills an alias and preserves canonical routing", async ({ page }) => {
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const search = page.getByRole("combobox", { name: "Medical term" });
  await search.fill("hypoglycae");

  await page.getByRole("option", { name: "hypoglycaemia Alias for hypoglycemia" }).click();

  await expect(search).toHaveValue("hypoglycaemia");
  await expect(search).toBeFocused();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/term\/hypoglycemia\/$/);
});

test("analyzer suggestions and no-result recovery remain local", async ({ page }) => {
  await page.goto(appUrl("/analyze/"), { waitUntil: "networkidle" });
  const search = page.getByRole("combobox", { name: "Medical term" });
  await search.fill("dermatofibro");

  await expect(page.getByRole("option", { name: "dermatofibrosarcoma" })).toBeVisible();
  await search.fill("xyzzy");
  await expect(page.getByText("No verified matches. Check the spelling, or press Enter to analyze this term.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse verified terms" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset search" })).toBeVisible();
  await search.press("Enter");

  await expect(page).toHaveURL(/\/analyze\/\?term=xyzzy$/);
  await expect(page.locator("[data-result-status='unsupported']")).toBeVisible();
});
