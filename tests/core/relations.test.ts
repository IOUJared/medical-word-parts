import { describe, expect, it } from "vitest";

import { getPartUsage, getRelatedTerms } from "../../src/core/relations";

describe("corpus relations", () => {
  it("Given either side of an explicit relation, when looked up, then the contrast is symmetric", () => {
    const hypo = getRelatedTerms("term:hypoglycemia");
    const hyper = getRelatedTerms("term:hyperglycemia");

    expect(hypo).toEqual([
      {
        kind: "contrast",
        term: { id: "term:hyperglycemia", slug: "hyperglycemia", term: "hyperglycemia" },
        citations: ["source:medlineplus-appendix-a"],
      },
    ]);
    expect(hyper).toEqual([
      {
        kind: "contrast",
        term: { id: "term:hypoglycemia", slug: "hypoglycemia", term: "hypoglycemia" },
        citations: ["source:medlineplus-appendix-a"],
      },
    ]);
  });

  it("Given a related pair, when looked up, then the authored relation kind is retained", () => {
    const results = getRelatedTerms("term:pericarditis");

    expect(results).toEqual([
      {
        kind: "related",
        term: { id: "term:endocarditis", slug: "endocarditis", term: "endocarditis" },
        citations: ["source:medlineplus-appendix-a"],
      },
    ]);
  });

  it("Given a part used by multiple terms, when looked up, then reverse usage is lexical", () => {
    const results = getPartUsage("root:card");

    expect(results.map((term) => term.id)).toEqual([
      "term:bradycardia",
      "term:endocarditis",
      "term:myocarditis",
      "term:pericarditis",
      "term:tachycardia",
    ]);
  });

  it("Given a part present in alternative analyses, when looked up, then usage remains deduplicated", () => {
    expect(getPartUsage("root:adren").map((term) => term.id)).toEqual(["term:adrenal"]);
  });

  it("Given an unused part or unknown identifier, when looked up, then no usage or relations are returned", () => {
    expect(getPartUsage("root:adreno")).toEqual([]);
    expect(getPartUsage("root:unknown")).toEqual([]);
    expect(getRelatedTerms("term:unknown")).toEqual([]);
  });
});
