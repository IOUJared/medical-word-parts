import { describe, expect, it } from "vitest";

import { analyzeTerm } from "../../src/core/analyzer";
import { unsupportedReasons } from "../../src/core/types";

describe("deterministic term analyzer", () => {
  it("Given mixed case and whitespace, when analyzed, then it resolves the normalized exact term", () => {
    const result = analyzeTerm("  AdReNaL  ");

    expect(result.kind).toBe("exact");
    if (result.kind !== "exact") return;
    expect(result.normalized).toBe("adrenal");
    expect(result.term.id).toBe("term:adrenal");
    expect(result.provenance).toEqual({ kind: "canonical" });
  });

  it("Given compatibility-width Latin letters, when analyzed, then NFKC normalization resolves the exact term", () => {
    const result = analyzeTerm("ＡＤＲＥＮＡＬ");

    expect(result.kind).toBe("exact");
    if (result.kind !== "exact") return;
    expect(result.normalized).toBe("adrenal");
  });

  it("Given an authored spelling alias, when analyzed, then alias provenance and the canonical target are preserved", () => {
    const result = analyzeTerm(" Hypoglycaemia ");

    expect(result.kind).toBe("exact");
    if (result.kind !== "exact") return;
    expect(result.term.id).toBe("term:hypoglycemia");
    expect(result.provenance).toEqual({
      kind: "alias",
      alias: "hypoglycaemia",
      citations: ["source:ncbi-medical-terminology"],
    });
  });

  it("Given adrenal, when analyzed, then authored primary and qualified alternative analyses are returned", () => {
    const result = analyzeTerm("adrenal");

    expect(result.kind).toBe("exact");
    if (result.kind !== "exact") return;
    expect(result.confidence).toEqual({ basis: "verified", score: 1 });
    expect(result.term.citations).toEqual(["source:ncbi-medical-terminology"]);
    expect(result.primary.segments.map((segment) => segment.partId)).toEqual([
      "prefix:ad",
      "root:ren",
      "suffix:al",
    ]);
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives[0]?.segments.map((segment) => segment.partId)).toEqual([
      "root:adren",
      "suffix:al",
    ]);
    expect(result.alternatives[0]?.qualification).toContain("alternative stem analysis");
  });

  it("Given cytokine, when analyzed, then the authored combining surface and qualification are retained", () => {
    const result = analyzeTerm("cytokine");

    expect(result.kind).toBe("exact");
    if (result.kind !== "exact") return;
    expect(result.primary.qualification).toContain("lexicalized -kine");
    expect(result.primary.segments[0]).toMatchObject({
      start: 0,
      end: 4,
      surface: "cyto",
      partId: "combining:cyt-o",
      notation: "cyt/o",
      kind: "combiningForm",
      meaning: "cell",
      citations: ["source:ncbi-medical-terminology"],
      transformations: [],
    });
  });

  it("Given hypoglycemia, when analyzed, then its dropped combining vowel transformation is exposed", () => {
    const result = analyzeTerm("hypoglycemia");

    expect(result.kind).toBe("exact");
    if (result.kind !== "exact") return;
    expect(result.primary.segments[1]).toMatchObject({
      start: 4,
      end: 8,
      surface: "glyc",
      partId: "combining:glyc-o",
      transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }],
    });
  });

  it.each([
    ["", "empty"],
    ["renal3", "unsupported_characters"],
    ["renal term", "multiple_words"],
    ["a".repeat(81), "too_long"],
  ] as const)(
    "Given malformed input %j, when analyzed, then it returns unsupported reason %s without throwing",
    (input, reason) => {
      const result = analyzeTerm(input);

      expect(result).toMatchObject({ kind: "unsupported", reason });
    },
  );

  it("Given unsupported inputs, when every reason is exercised, then the public reason vocabulary remains complete", () => {
    const inputs = ["", "a".repeat(81), "renal term", "renal3", "xyz"] as const;

    const reasons = inputs.flatMap((input) => {
      const result = analyzeTerm(input);
      return result.kind === "unsupported" ? [result.reason] : [];
    });

    expect(new Set(reasons)).toEqual(new Set(unsupportedReasons));
  });

  it("Given an internal separator, when analyzed, then the accepted input reaches deterministic segmentation", () => {
    const result = analyzeTerm("nephro-itis");

    expect(result.kind).toBe("partial");
    if (result.kind !== "partial") return;
    expect(result.segments.map((segment) => segment.partId)).toEqual(["root:nephro", "suffix:itis"]);
    expect(result.unresolvedSpans).toEqual([{ start: 6, end: 7, surface: "-" }]);
  });

  it("Given an internal apostrophe, when analyzed, then it is accepted and reported as an unresolved span", () => {
    const result = analyzeTerm("nephro'itis");

    expect(result.kind).toBe("partial");
    if (result.kind !== "partial") return;
    expect(result.unresolvedSpans).toEqual([{ start: 6, end: 7, surface: "'" }]);
  });

  it("Given a complete unverified combination, when analyzed, then it returns a derived analysis", () => {
    const result = analyzeTerm("hyponephritis");

    expect(result.kind).toBe("derived");
    if (result.kind !== "derived") return;
    expect(result.confidence).toEqual({ basis: "complete_coverage", score: 0.9 });
    expect(result.segments.map((segment) => segment.partId)).toEqual([
      "prefix:hypo",
      "root:nephr",
      "suffix:itis",
    ]);
    expect(result.unresolvedSpans).toEqual([]);
  });

  it("Given overlapping complete candidates, when analyzed, then fewer segments rank first and alternatives remain", () => {
    const result = analyzeTerm("adrenalgia");

    expect(result.kind).toBe("derived");
    if (result.kind !== "derived") return;
    expect(result.segments.map((segment) => segment.partId)).toEqual(["root:adren", "suffix:algia"]);
    expect(result.alternatives[0]?.segments.map((segment) => segment.partId)).toEqual([
      "prefix:ad",
      "root:ren",
      "suffix:algia",
    ]);
  });

  it("Given a one-character gap, when analyzed, then it returns partial coverage and the unresolved span", () => {
    const result = analyzeTerm("hypoxnephritis");

    expect(result.kind).toBe("partial");
    if (result.kind !== "partial") return;
    expect(result.confidence.basis).toBe("partial_coverage");
    expect(result.confidence.score).toBeCloseTo(0.84, 2);
    expect(result.unresolvedSpans).toEqual([{ start: 4, end: 5, surface: "x" }]);
  });

  it("Given a known part followed only by unknown text, when analyzed, then trailing text remains partial", () => {
    const result = analyzeTerm("hypoxyz");

    expect(result.kind).toBe("partial");
    if (result.kind !== "partial") return;
    expect(result.segments.map((segment) => segment.partId)).toEqual(["prefix:hypo"]);
    expect(result.unresolvedSpans).toEqual([{ start: 4, end: 7, surface: "xyz" }]);
  });

  it("Given a valid word with no known parts, when analyzed, then it returns fully unsupported", () => {
    const result = analyzeTerm("xyz");

    expect(result).toEqual({
      kind: "unsupported",
      input: "xyz",
      normalized: "xyz",
      reason: "no_known_parts",
    });
  });

  it("Given the same term twice, when analyzed, then repeated output is deeply equal", () => {
    const first = analyzeTerm("adrenalgia");
    const second = analyzeTerm("adrenalgia");

    expect(second).toEqual(first);
  });
});
