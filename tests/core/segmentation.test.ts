import { describe, expect, it } from "vitest";

import { segmentTerm } from "../../src/core/segmentation";

describe("candidate segmentation", () => {
  it("Given more than six ranked paths, when segmented, then the best six retain deterministic order", () => {
    const candidates = segmentTerm("adadrenadren");

    expect(candidates).toHaveLength(6);
    expect(candidates.map((candidate) => candidate.segments.map((segment) => segment.partId))).toEqual([
      ["prefix:ad", "root:adren", "root:adren"],
      ["prefix:a", "root:adren", "root:adren"],
      ["root:adren", "root:adren"],
      ["prefix:ad", "root:adren", "root:ren"],
      ["prefix:ad", "root:ren", "root:adren"],
      ["prefix:a", "root:adren", "root:ren"],
    ]);
  });
});
