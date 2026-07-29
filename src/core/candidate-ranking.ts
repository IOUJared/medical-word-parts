export type CandidateRank = {
  readonly complete: boolean;
  readonly coveredCharacterCount: number;
  readonly unmatchedCharacterCount: number;
  readonly segmentCount: number;
  readonly leftmostLengths: readonly number[];
  readonly partIds: readonly string[];
};

function compareDescending(left: number, right: number): number {
  return right - left;
}

function compareAscending(left: number, right: number): number {
  return left - right;
}

function compareNumberLists(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    const comparison = compareDescending(leftValue, rightValue);
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareStringLists(left: readonly string[], right: readonly string[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? "";
    const rightValue = right[index] ?? "";
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

export function compareCandidateRanks(left: CandidateRank, right: CandidateRank): number {
  if (left.complete !== right.complete) return left.complete ? -1 : 1;

  const covered = compareDescending(left.coveredCharacterCount, right.coveredCharacterCount);
  if (covered !== 0) return covered;

  const unmatched = compareAscending(left.unmatchedCharacterCount, right.unmatchedCharacterCount);
  if (unmatched !== 0) return unmatched;

  const segments = compareAscending(left.segmentCount, right.segmentCount);
  if (segments !== 0) return segments;

  const leftmost = compareNumberLists(left.leftmostLengths, right.leftmostLengths);
  if (leftmost !== 0) return leftmost;

  return compareStringLists(left.partIds, right.partIds);
}
