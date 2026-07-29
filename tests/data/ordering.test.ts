import { describe, expect, it } from "vitest";

import { compareCodePoints } from "../../src/data/ordering";

describe("generated identifier ordering", () => {
  it("Given IDs containing allowed separators, when sorted, then raw code-point order is stable", () => {
    const identifiers = ["term:z", "term:a0", "term:aa", "term:a-1", "term:a"] as const;

    expect([...identifiers].sort(compareCodePoints)).toEqual([
      "term:a",
      "term:a-1",
      "term:a0",
      "term:aa",
      "term:z",
    ]);
  });
});
