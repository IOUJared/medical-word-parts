import { describe, expect, it } from "vitest";

import { analyzeTerm } from "../../src/core/analyzer";

describe("derived combining-vowel segmentation", () => {
  it("Given glyc/o immediately before vowel-start -emia, when analyzed, then the dropped surface is complete", () => {
    const result = analyzeTerm("glycemia");

    expect(result.kind).toBe("derived");
    if (result.kind !== "derived") return;
    expect(result.unresolvedSpans).toEqual([]);
    expect(result.segments).toMatchObject([
      {
        partId: "combining:glyc-o",
        surface: "glyc",
        transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }],
      },
      { partId: "suffix:emia", surface: "emia", transformations: [] },
    ]);
  });

  it.each([
    ["at the end", "glyc"],
    ["before unresolved text", "glycxemia"],
    ["before a root", "glycren"],
    ["before a combining form", "glyccyto"],
    ["before a consonant-start suffix", "glyckine"],
  ] as const)(
    "Given glyc/o dropped %s, when analyzed, then no complete or partial candidate uses the dropped surface",
    (_context, input) => {
      const result = analyzeTerm(input);

      expect(result.kind).not.toBe("derived");
      if (result.kind !== "partial") return;
      const candidateSegments = [result, ...result.alternatives].flatMap((analysis) => analysis.segments);
      expect(
        candidateSegments.some((segment) =>
          segment.transformations.some((transformation) => transformation.kind === "drop_terminal_vowel"),
        ),
      ).toBe(false);
    },
  );
});
