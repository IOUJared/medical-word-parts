import { afterEach, describe, expect, it } from "vitest";

import { applyThemeBootstrap, parseTheme, themeStorageKey } from "../../src/theme/client";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("theme boundary parsing", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    [null, undefined],
    ["sepia", undefined],
    ["DARK", undefined],
    ["", undefined],
  ] as const)("Given stored value %s, when parsed, then only exact light and dark are accepted", (value, expected) => {
    expect(parseTheme(value)).toBe(expected);
  });

  it("Given a valid persisted choice, when the bootstrap runs, then it applies only the explicit root attribute", () => {
    localStorage.setItem(themeStorageKey, "dark");

    applyThemeBootstrap(window);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("Given invalid persisted state, when the bootstrap runs, then the root remains in automatic mode", () => {
    localStorage.setItem(themeStorageKey, "sepia");
    document.documentElement.dataset["theme"] = "dark";

    applyThemeBootstrap(window);

    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});
