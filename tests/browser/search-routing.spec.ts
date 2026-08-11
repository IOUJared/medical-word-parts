import { expect, test } from "@playwright/test";

import { appUrl } from "./fixtures";

test("known search routes canonically and survives a direct refresh", async ({ page }) => {
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  await page.getByRole("searchbox", { name: "Medical term" }).fill("adrenal");
  await page.getByRole("searchbox", { name: "Medical term" }).press("Enter");

  await expect(page).toHaveURL(/\/term\/adrenal\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "adrenal" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "adrenal" })).toBeVisible();
});
