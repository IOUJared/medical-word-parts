import { describe, expect, it } from "vitest";

import { enhancerScriptStrategy } from "../../src/lib/enhancer-script";

describe("progressive enhancer script lifecycle", () => {
  it.each([
    ["development", "lazyOnload"],
    ["production", "afterInteractive"],
  ] as const)("Given %s mode, when the lifecycle is selected, then it uses %s", (environment, expected) => {
    expect(enhancerScriptStrategy(environment)).toBe(expected);
  });
});
