import { expect, test } from "@playwright/test";

import { appUrl } from "./fixtures";

test("archived candidates do not resolve to term pages and the discovery queue shows its empty state", async ({ page }) => {
  for (const term of ["homeostasis", "epidermis", "vasoconstriction"] as const) {
    const response = await page.goto(appUrl(`/term/${term}/`), { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Not found")).toBeVisible();
    await expect(page.locator("a[href*='github.com/IOUJared/medical-word-parts/issues/new']")).toHaveCount(0);
  }

  await page.goto(appUrl("/common-medical-terms/"), { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Candidate discovery queue" })).toBeVisible();
  await expect(page.getByText("No candidate terms are currently awaiting verification.")).toBeVisible();
  await expect(page.getByText("Candidate only - no verified word parts yet")).toHaveCount(0);
});
