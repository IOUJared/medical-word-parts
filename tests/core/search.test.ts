import { describe, expect, it } from "vitest";

import { searchCorpus } from "../../src/core/search";

describe("deterministic corpus search", () => {
  it("Given a canonical term, when searched, then the exact term match ranks first", () => {
    const results = searchCorpus({ query: " Hypoglycemia " });

    expect(results[0]).toMatchObject({
      kind: "term",
      id: "term:hypoglycemia",
      matchedBy: { kind: "exact", field: "term", value: "hypoglycemia" },
    });
  });

  it("Given an open-source candidate term, when searched, then it is returned as awaiting verification", () => {
    const results = searchCorpus({ query: "diabetes" });

    expect(results[0]).toMatchObject({
      kind: "candidateTerm",
      id: "candidate:diabetes",
      term: "diabetes",
      status: "candidate",
      matchedBy: { kind: "exact", field: "term", value: "diabetes" },
    });
  });

  it("Given a verified term and a candidate prefix match, when searched, then verified results rank first", () => {
    const results = searchCorpus({ query: "neph" });

    expect(results.map((result) => result.id).slice(0, 7)).toEqual([
      "term:nephralgia",
      "term:nephrectomy",
      "term:nephritis",
      "term:nephroma",
      "term:nephropathy",
      "term:nephrostomy",
      "term:nephrotomy",
    ]);
    expect(results.map((result) => result.id).slice(7, 9)).toEqual(["root:nephr", "root:nephro"]);
    expect(results.map((result) => result.id).slice(9)).toEqual([
      "candidate:nephrotic-syndrome",
      "candidate:balkan-nephropathy",
      "candidate:diabetic-nephropathies",
      "term:glomerulonephritis",
      "candidate:hydronephrosis",
    ]);
  });

  it("Given an alias spelling, when searched, then its canonical term carries alias evidence", () => {
    const results = searchCorpus({ query: "hypoglycaemia" });

    expect(results[0]).toMatchObject({
      kind: "term",
      id: "term:hypoglycemia",
      matchedBy: { kind: "exact", field: "alias", value: "hypoglycaemia" },
      aliases: ["hypoglycaemia"],
    });
  });

  it("Given a part notation, when searched, then the exact notation is returned", () => {
    const results = searchCorpus({ query: "GLYC/O" });

    expect(results[0]).toMatchObject({
      kind: "combiningForm",
      id: "combining:glyc-o",
      notation: "glyc/o",
      matchedBy: { kind: "exact", field: "notation", value: "glyc/o" },
    });
  });

  it("Given a dropped-vowel surface, when searched, then the combining form exposes the exact surface", () => {
    const results = searchCorpus({ query: "glyc" });

    expect(results[0]).toMatchObject({
      kind: "combiningForm",
      id: "combining:glyc-o",
      matchedBy: { kind: "exact", field: "surface", value: "glyc" },
    });
  });

  it("Given a shared prefix, when searched, then exact matches precede prefix matches", () => {
    const results = searchCorpus({ query: "hypo" });

    expect(results.map((result) => result.id).slice(0, 2)).toEqual([
      "prefix:hypo",
      "term:hypoglycemia",
    ]);
    expect(results[1]?.matchedBy.kind).toBe("prefix");
  });

  it("Given a meaning token, when searched, then exact meaning precedes token-prefix meaning", () => {
    const results = searchCorpus({ query: "condition" });

    expect(results.map((result) => result.id).slice(0, 3)).toEqual(["suffix:ia", "suffix:osis", "suffix:emia"]);
    expect(results[0]?.matchedBy.kind).toBe("exact");
    expect(results[1]?.matchedBy.kind).toBe("prefix");
    expect(results[2]?.matchedBy.kind).toBe("token_prefix");
  });

  it("Given a meaning prefix, when searched, then it records prefix evidence", () => {
    const results = searchCorpus({ query: "blood" });

    expect(results.map((result) => result.id).slice(0, 7)).toEqual([
      "combining:hem-o",
      "root:hem",
      "root:hemat",
      "root:hemato",
      "root:angi",
      "root:angio",
      "suffix:emia",
    ]);
    expect(results[0]).toMatchObject({ matchedBy: { kind: "exact", field: "meaning", value: "blood" } });
    expect(results[1]).toMatchObject({ matchedBy: { kind: "exact", field: "meaning", value: "blood" } });
    expect(results[4]).toMatchObject({ matchedBy: { kind: "prefix", field: "meaning", value: "blood vessel" } });
    expect(results[6]).toMatchObject({ matchedBy: { kind: "prefix", field: "meaning", value: "blood condition" } });
  });

  it("Given a meaning substring, when searched, then it records substring evidence", () => {
    const results = searchCorpus({ query: "flammation" });

    expect(results[0]).toMatchObject({
      id: "suffix:itis",
      matchedBy: { kind: "substring", field: "meaning", value: "inflammation" },
    });
  });

  it("Given lexical ties, when searched, then IDs provide stable final ordering", () => {
    const first = searchCorpus({ query: "kidney" });
    const second = searchCorpus({ query: "kidney" });

    expect(first.map((result) => result.id)).toEqual([
      "root:nephr",
      "root:nephro",
      "root:ren",
      "root:reno",
      "candidate:chronic-kidney-disease",
    ]);
    expect(second).toEqual(first);
  });

  it("Given a kind filter, when searched, then only requested kinds remain", () => {
    const results = searchCorpus({ query: "cell", kinds: ["suffix"] });

    expect(results.map((result) => result.id)).toEqual(["suffix:cyte"]);
  });

  it("Given an empty query, when searched, then it returns no results", () => {
    expect(searchCorpus({ query: "  " })).toEqual([]);
  });

  it("Given a query with no verified or candidate corpus match, when searched, then it returns no results", () => {
    expect(searchCorpus({ query: "quartz" })).toEqual([]);
  });

  it("Given a result limit, when searched, then the limit is applied after deterministic ranking", () => {
    const results = searchCorpus({ query: "kidney", limit: 2 });

    expect(results.map((result) => result.id)).toEqual(["root:nephr", "root:nephro"]);
    expect(searchCorpus({ query: "kidney", limit: 0 })).toEqual([]);
  });
});
