import { expect, test } from "@playwright/test";

import { appUrl, visualRoutes } from "./fixtures";

declare global {
  interface Window {
    firstPaintTheme?: string;
    verifierCls: number;
  }
}

test.describe.configure({ mode: "serial" });

test("every route carries exactly one local parser-blocking theme bootstrap as a direct head child", async ({ page }) => {
  for (const route of visualRoutes) {
    await page.goto(appUrl(route.path), { waitUntil: "networkidle" });
    const themeScript = page.locator("head > script[src='/medical-word-parts/generated/theme.js']");

    await expect(themeScript).toHaveCount(1);
    expect(await themeScript.evaluate((script) => Object.fromEntries([...script.attributes].map((attribute) => [attribute.name, attribute.value])))).toEqual({ src: "/medical-word-parts/generated/theme.js" });
    await expect(page.locator("body script[src$='/generated/theme.js']")).toHaveCount(0);
  }
});

test("persisted dark overrides a light system before first paint", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  await context.addInitScript(() => {
    localStorage.setItem("medical-word-parts:theme", "dark");
    window.verifierCls = 0;
    new PerformanceObserver((entries) => {
      if (entries.getEntries().some((entry) => entry.name === "first-paint")) window.firstPaintTheme = document.documentElement.dataset["theme"] ?? "";
    }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        const data = entry.toJSON();
        if (data["hadRecentInput"] !== true && typeof data["value"] === "number") window.verifierCls += data["value"];
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();

  await page.goto(appUrl("/"), { waitUntil: "networkidle" });

  await expect.poll(() => page.evaluate(() => window.firstPaintTheme)).toBe("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.verifierCls)).toBeLessThan(0.01);
  await context.close();
});

test("mobile theme enhancement preserves reserved navigation geometry", async ({ browser }) => {
  for (const fixture of [
    { colorScheme: "light", persistedTheme: null },
    { colorScheme: "dark", persistedTheme: null },
    { colorScheme: "dark", persistedTheme: "light" },
    { colorScheme: "light", persistedTheme: "dark" },
  ] as const) {
    const context = await browser.newContext({
      colorScheme: fixture.colorScheme,
      viewport: { width: 412, height: 823 },
    });
    await context.addInitScript((persistedTheme) => {
      if (persistedTheme !== null) localStorage.setItem("medical-word-parts:theme", persistedTheme);
      window.verifierCls = 0;
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          const data = entry.toJSON();
          if (data["hadRecentInput"] !== true && typeof data["value"] === "number") {
            window.verifierCls += data["value"];
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    }, fixture.persistedTheme);
    const page = await context.newPage();
    await page.route("**/generated/site.js", (route) => route.abort());
    await page.goto(appUrl("/parts/?kind=prefix"), { waitUntil: "networkidle" });
    const toggle = page.locator("[data-theme-toggle]");
    const navActions = page.locator(".nav-actions");

    await expect(page.getByRole("button", { name: "Dark mode" })).toHaveCount(0);
    expect(await toggle.evaluate((button) => {
      button.focus();
      return document.activeElement === button;
    })).toBe(false);
    const before = await page.locator(".nav-actions, [data-theme-toggle]").evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { height: bounds.height, width: bounds.width, x: bounds.x, y: bounds.y };
      }),
    );

    await page.unroute("**/generated/site.js");
    await page.addScriptTag({ type: "module", url: `${appUrl("/generated/site.js")}?enhance=1` });

    await expect(page.getByRole("button", { name: "Dark mode" })).toBeVisible();
    const after = await page.locator(".nav-actions, [data-theme-toggle]").evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { height: bounds.height, width: bounds.width, x: bounds.x, y: bounds.y };
      }),
    );
    expect(after).toEqual(before);
    expect(await page.evaluate(() => window.verifierCls)).toBeLessThanOrEqual(0.01);
    await expect(navActions).toBeVisible();
    await context.close();
  }
});

test("theme control retains native keyboard activation, focus, targets, and reduced-motion behavior in forced colors", async ({ browser }) => {
  const context = await browser.newContext({ forcedColors: "active", reducedMotion: "reduce", viewport: { width: 375, height: 900 } });
  const page = await context.newPage();
  await page.goto(appUrl("/term/hypoglycemia/"), { waitUntil: "networkidle" });
  const toggle = page.getByRole("button", { name: "Dark mode" });

  await toggle.focus();
  await expect(toggle).toBeFocused();
  const presentation = await toggle.evaluate((button) => {
    const style = getComputedStyle(button);
    const bounds = button.getBoundingClientRect();
    return { height: bounds.height, outlineStyle: style.outlineStyle, transitionDuration: style.transitionDuration, width: bounds.width };
  });
  expect(presentation.height).toBeGreaterThanOrEqual(44);
  expect(presentation.width).toBeGreaterThanOrEqual(44);
  expect(presentation.outlineStyle).not.toBe("none");
  expect(presentation.transitionDuration).toBe("0s");

  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await context.close();
});

test("explicit theme persists across navigation and reload while system changes affect automatic mode only", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(appUrl("/"), { waitUntil: "networkidle" });
  const toggle = page.getByRole("button", { name: "Dark mode" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(appUrl("/term/hypoglycemia/"), { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() => {
    localStorage.removeItem("medical-word-parts:theme");
    document.documentElement.removeAttribute("data-theme");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});

test("invalid and blocked storage safely retain system fallback", async ({ browser }) => {
  const invalidContext = await browser.newContext({ colorScheme: "dark" });
  await invalidContext.addInitScript(() => localStorage.setItem("medical-word-parts:theme", "sepia"));
  const invalidPage = await invalidContext.newPage();
  await invalidPage.goto(appUrl("/"), { waitUntil: "networkidle" });
  await expect(invalidPage.locator("html")).not.toHaveAttribute("data-theme");
  await expect(invalidPage.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
  await invalidContext.close();

  const blockedContext = await browser.newContext({ colorScheme: "dark" });
  await blockedContext.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("blocked", "SecurityError"); };
  });
  const blockedPage = await blockedContext.newPage();
  await blockedPage.goto(appUrl("/"), { waitUntil: "networkidle" });
  await expect(blockedPage.locator("html")).not.toHaveAttribute("data-theme");
  await expect(blockedPage.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true");
  await blockedContext.close();
});

test("without JavaScript each system theme applies while the control stays hidden", async ({ browser }) => {
  for (const fixture of [
    { colorScheme: "light", field: "rgb(241, 244, 243)" },
    { colorScheme: "dark", field: "rgb(16, 20, 22)" },
  ] as const) {
    const context = await browser.newContext({ colorScheme: fixture.colorScheme, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(appUrl("/"), { waitUntil: "load" });

    await expect(page.locator("[data-theme-toggle]")).toBeHidden();
    expect(await page.locator("html").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(fixture.field);
    await context.close();
  }
});
