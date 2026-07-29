import { describe, expect, it } from "vitest";

import { unionCitations } from "../../src/core/analyzer";

describe("citation union", () => {
  it("Given authored citation groups with repeats, when merged, then first-seen order is preserved without duplicates", () => {
    const citations = unionCitations(
      ["source:ncbi-medical-terminology"],
      ["source:medlineplus-appendix-a", "source:ncbi-medical-terminology"],
      ["source:medlineplus-appendix-a"],
    );

    expect(citations).toEqual([
      "source:ncbi-medical-terminology",
      "source:medlineplus-appendix-a",
    ]);
  });
});
