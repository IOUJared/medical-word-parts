import { describe, expect, it } from "vitest";

import { compareCandidateRanks, type CandidateRank } from "../../src/core/candidate-ranking";

const baseline: CandidateRank = {
  complete: true,
  coveredCharacterCount: 8,
  unmatchedCharacterCount: 0,
  segmentCount: 2,
  leftmostLengths: [4, 4],
  partIds: ["root:card", "suffix:itis"],
};

describe("candidate rank comparator", () => {
  it.each([
    [
      "complete coverage",
      { ...baseline, complete: true },
      { ...baseline, complete: false },
    ],
    [
      "covered character count",
      { ...baseline, coveredCharacterCount: 9 },
      { ...baseline, coveredCharacterCount: 8 },
    ],
    [
      "fewest unmatched characters",
      { ...baseline, unmatchedCharacterCount: 1 },
      { ...baseline, unmatchedCharacterCount: 2 },
    ],
    ["fewest segments", { ...baseline, segmentCount: 2 }, { ...baseline, segmentCount: 3 }],
    [
      "longest leftmost match",
      { ...baseline, leftmostLengths: [5, 3] },
      { ...baseline, leftmostLengths: [4, 4] },
    ],
    [
      "lexical part ID order",
      { ...baseline, partIds: ["root:card", "suffix:itis"] },
      { ...baseline, partIds: ["root:cardi", "suffix:itis"] },
    ],
  ] as const)("Given a tie through %s, when ranked, then the mandated axis breaks the tie", (_axis, first, second) => {
    expect(compareCandidateRanks(first, second)).toBeLessThan(0);
    expect(compareCandidateRanks(second, first)).toBeGreaterThan(0);
  });
});
