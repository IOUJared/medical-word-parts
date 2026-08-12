import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { appUrl } from "./fixtures";

declare global {
  interface Window {
    verifierCls: number;
  }
}

test.describe.configure({ mode: "serial" });

test("representative verified terms begin with breadcrumb, identity, concise construction, and parts", async ({ page }) => {
  for (const slug of [
    "achondroplasia",
    "adrenal",
    "anaplasia",
    "aphakia",
    "aphasia",
    "aphonia",
    "apnea",
    "aortitis",
    "appendicitis",
    "chondroma",
    "cholestasis",
    "cytokine",
    "dyspnea",
    "dyspepsia",
    "dystonia",
    "epiglottitis",
    "fasciitis",
    "hemothorax",
    "hemiplegia",
    "glomerulonephritis",
    "hypoglycemia",
  ] as const) {
    await page.goto(appUrl(`/term/${slug}/`), { waitUntil: "networkidle" });
    const leadingBlocks = page.locator(".term-page > *");

    await expect(leadingBlocks.nth(0)).toHaveClass(/breadcrumbs/);
    await expect(leadingBlocks.nth(1)).toHaveClass(/term-opening/);
    await expect(leadingBlocks.nth(1).getByRole("heading", { level: 1, name: slug })).toBeVisible();
    await expect(leadingBlocks.nth(1).getByText("Verified entry")).toBeVisible();
    await expect(leadingBlocks.nth(2)).toHaveClass(/term-construction/);
    await expect(leadingBlocks.nth(2).getByRole("heading", { level: 2, name: "Construction" })).toBeVisible();
    await expect(leadingBlocks.nth(3)).toHaveClass(/term-parts/);
    await expect(page.getByText(slug, { exact: true })).toHaveCount(2);
    await expect(page.locator(".reconstruction")).toHaveCount(0);
    await expect(page.getByText("Authored note")).toHaveCount(0);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("mobile navigation opens, closes with Escape, and returns focus", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.verifierCls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const data = entry.toJSON();
        if (data["hadRecentInput"] !== true && typeof data["value"] === "number") window.verifierCls += data["value"];
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mobile-menu")).toBeVisible();
  await expect(page.locator("#mobile-menu").getByRole("link", { name: "Methodology" })).toBeVisible();
  const backdropColors = await page.locator("#mobile-menu").evaluate((popover) => {
    const backdrop = getComputedStyle(popover, "::backdrop").backgroundColor;
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--color-scrim)";
    document.body.append(probe);
    const token = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { backdrop, token };
  });
  expect(backdropColors.backdrop).toBe(backdropColors.token);
  expect(backdropColors.backdrop).not.toMatch(/transparent|rgba?\([^)]*,\s*0\s*\)$/);
  await page.keyboard.press("Escape");

  await expect(page.locator("#mobile-menu")).toBeHidden();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => window.verifierCls)).toBeLessThan(0.01);
  expect(consoleErrors).toEqual([]);
});

test("mobile navigation remains a native operable popover without JavaScript or stale expanded state", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
  const page = await context.newPage();
  await page.goto(appUrl("/"), { waitUntil: "load" });
  const menu = page.getByRole("button", { name: "Menu" });

  await expect(menu).not.toHaveAttribute("aria-expanded");
  await menu.click();

  await expect(page.locator("#mobile-menu")).toBeVisible();
  await context.close();
});

test("analyzer preserves encoded query state, status variants, keyboard focus, and copy fallback", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(appUrl("/analyze/"), { waitUntil: "networkidle" });
  const field = page.getByRole("combobox", { name: "Medical term" });
  await field.fill("hypo nephritis");
  await field.press("Enter");

  await expect(page).toHaveURL(/term=hypo\+nephritis$/);
  await expect(page.getByLabel("Analysis result")).toBeFocused();
  await expect(page.locator("[data-result-status='unsupported']")).toBeVisible();

  await field.fill("hyponephritis");
  await field.press("Enter");
  await expect(page.locator("[data-result-status='derived']")).toBeVisible();

  await field.fill("hypoxnephritis");
  await field.press("Enter");
  await expect(page.locator("[data-result-status='partial'] [data-unresolved='true'][data-surface='x']").first()).toContainText("x");
  await page.getByText("Copyable fallback template").first().click();
  await page.getByRole("button", { name: "Copy template" }).first().click();
  await expect(page.getByText("Template copied.").first()).toBeVisible();
});

test("analyzer adds only its local progressive module beyond the shared framework scripts", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const sharedScripts = await page.locator("script[src]").evaluateAll((scripts) => scripts.map((script) => script.getAttribute("src")));
  await page.goto(appUrl("/analyze/?term=hypoxnephritis"), { waitUntil: "networkidle" });
  const analyzerScripts = await page.locator("script[src]").evaluateAll((scripts) => scripts.map((script) => script.getAttribute("src")));

  expect(analyzerScripts.filter((source) => !sharedScripts.includes(source))).toEqual(["/medical-word-parts/generated/analyzer.js"]);
  expect(await page.locator("script[src='/medical-word-parts/generated/analyzer.js']").count()).toBe(1);
  expect(consoleErrors).toEqual([]);
});

test("parts adds only its local progressive module beyond the shared framework scripts", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const sharedScripts = await page.locator("script[src]").evaluateAll((scripts) => scripts.map((script) => script.getAttribute("src")));
  await page.goto(appUrl("/parts/?kind=prefix"), { waitUntil: "networkidle" });
  const partsScripts = await page.locator("script[src]").evaluateAll((scripts) => scripts.map((script) => script.getAttribute("src")));

  expect(partsScripts.filter((source) => !sharedScripts.includes(source))).toEqual(["/medical-word-parts/generated/parts.js"]);
  expect(await page.locator("script[src='/medical-word-parts/generated/parts.js']").count()).toBe(1);
  expect(consoleErrors).toEqual([]);
});

test("analyzer server form and explanation remain available without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(appUrl("/analyze/?term=hypoxnephritis"), { waitUntil: "load" });

  await expect(page.getByRole("searchbox", { name: "Medical term" })).toBeVisible();
  await expect(page.getByText(/local analysis requires javascript/i)).toBeVisible();
  await expect(page.getByRole("search")).toHaveAttribute("action", "/medical-word-parts/analyze/");
  await context.close();
});

test("parts search, kind filter, and reset recover the collection", async ({ page }) => {
  await page.goto(appUrl("/parts/"), { waitUntil: "networkidle" });
  await page.getByRole("searchbox", { name: "Search word parts" }).fill("sugar");
  await expect(page.locator(".part-list > li:visible")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "glyc/o" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search word parts" }).fill("quartz");
  await expect(page.getByTestId("no-results")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".part-list > li:visible")).toHaveCount(163);
  await expect(page.getByRole("searchbox", { name: "Search word parts" })).toBeFocused();

  await page.getByRole("checkbox", { name: "Prefix" }).check();
  expect(await page.locator(".part-list > li:visible").evaluateAll((entries) => entries.every((entry) => entry.closest(".part-group")?.getAttribute("data-kind") === "prefix"))).toBe(true);
  await expect(page).toHaveURL(/\?kind=prefix$/);
});

test("parts direct query, mixed invalid values, and popstate remain synchronized without markup injection", async ({ page }) => {
  await page.goto(appUrl("/parts/?kind=prefix&kind=unknown&kind=%3Cimg%20src=x%20onerror=alert(1)%3E"), { waitUntil: "networkidle" });

  await expect(page.getByRole("checkbox", { name: "Prefix" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Root" })).not.toBeChecked();
  expect(await page.locator(".part-list > li:visible").evaluateAll((entries) => entries.every((entry) => entry.closest(".part-group")?.getAttribute("data-kind") === "prefix"))).toBe(true);
  await expect(page.locator("img")).toHaveCount(0);

  await page.evaluate(() => {
    window.history.pushState(null, "", "?kind=suffix");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("checkbox", { name: "Suffix" })).toBeChecked();
  await page.goBack();
  await expect(page.getByRole("checkbox", { name: "Prefix" })).toBeChecked();
});

test("home kind links load the intended parts filter and browser history stays synchronized", async ({ page }) => {
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const prefixLink = page.getByRole("link", { name: /^Prefixes/ });
  const expectedCount = Number((await prefixLink.locator("strong").textContent()) ?? "0");
  await prefixLink.click();

  await expect(page).toHaveURL(/\/parts\/?\?kind=prefix$/);
  await expect(page.getByRole("checkbox", { name: "Prefix" })).toBeChecked();
  await expect(page.getByRole("status")).toHaveText(`${expectedCount} of 163 parts`);

  await page.evaluate(() => {
    window.history.pushState(null, "", "?kind=suffix");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("checkbox", { name: "Suffix" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Prefix" })).not.toBeChecked();
  await page.goBack();
  await expect(page.getByRole("checkbox", { name: "Prefix" })).toBeChecked();
});

test("parts server index remains complete and honestly describes unavailable interactive filtering without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(appUrl("/parts/?kind=prefix"), { waitUntil: "load" });

  await expect(page.getByRole("searchbox", { name: "Search word parts" })).toBeVisible();
  await expect(page.locator(".part-list > li")).toHaveCount(163);
  await expect(page.getByRole("button", { name: "Apply filters" })).toHaveCount(0);
  await expect(page.getByText(/interactive filtering requires javascript/i)).toBeVisible();
  await context.close();
});

test("cold partial analysis keeps cumulative layout shift effectively zero", async ({ browser }) => {
  for (const viewport of [{ width: 412, height: 823 }, { width: 1350, height: 940 }] as const) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      window.verifierCls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const data = entry.toJSON();
          if (data["hadRecentInput"] !== true && typeof data["value"] === "number") window.verifierCls += data["value"];
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage();

    await page.goto(appUrl("/analyze/?term=hypoxnephritis"), { waitUntil: "networkidle" });

    await expect(page.locator("[data-result-status='partial']")).toBeVisible();
    expect(await page.evaluate(() => window.verifierCls)).toBeLessThan(0.01);
    await context.close();
  }
});

test("app icon metadata resolves to a successful local SVG resource", async ({ page, request }) => {
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const iconHref = await page.locator("link[rel='icon']").getAttribute("href");

  expect(iconHref).toBe("/medical-word-parts/icon.svg");
  const iconResponse = await request.get(appUrl("/icon.svg"));
  expect(iconResponse.status()).toBe(200);
  expect(iconResponse.headers()["content-type"]).toContain("image/svg+xml");
});

test("correction action is encoded and fallback copy acknowledges success", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(appUrl("/term/hypoglycemia/"), { waitUntil: "networkidle" });
  const correction = page.getByRole("link", { name: /Propose a correction on GitHub/ });
  const issueUrl = new URL(await correction.getAttribute("href") ?? "");

  expect(issueUrl.origin + issueUrl.pathname).toBe("https://github.com/IOUJared/medical-word-parts/issues/new");
  expect(issueUrl.searchParams.get("labels")).toBe("correction");
  expect(issueUrl.searchParams.get("current_analysis")).toBe("hypo- + glyc/o + -emia");
  await page.getByText("Copyable fallback template").click();
  await page.getByRole("button", { name: /Copy template/ }).click();
  await expect(page.getByText("Template copied.")).toBeVisible();
});

test("reduced motion and 200 percent zoom retain content without horizontal overflow", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(appUrl("/term/hypoglycemia/"), { waitUntil: "networkidle" });
  expect(await page.locator(".button").first().evaluate((button) => getComputedStyle(button).transitionDuration)).toBe("0s");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "hypoglycemia" })).toBeVisible();
  await context.close();
});
