import { candidateSurfaces } from "../generated/segmentation";
import { compareCandidateRanks, type CandidateRank } from "./candidate-ranking";
import { findPartById } from "./catalog";
import { CorpusInvariantError, assertNever } from "./invariants";
import type { CandidateAnalysis, Segment, Transformation, UnresolvedSpan } from "./types";

const maximumCandidates = 6;
const vowelStart = /^[aeiou]/;

type CandidateSurface = {
  readonly surface: string;
  readonly part: ReturnType<typeof findPartById>;
  readonly transformations: readonly Transformation[];
};

type Segmentation = {
  readonly segments: readonly Segment[];
};

function segmentationBucket(table: Readonly<Record<number, readonly Segmentation[]>>, offset: number): readonly Segmentation[] {
  const bucket = table[offset];
  if (bucket === undefined) throw new CorpusInvariantError(`segmentation-offset:${offset}`);
  return bucket;
}

function indexCandidateSurfaces(): ReadonlyMap<string, readonly CandidateSurface[]> {
  const index = new Map<string, CandidateSurface[]>();
  for (const candidate of candidateSurfaces) {
    const initial = candidate.surface[0];
    if (initial === undefined) continue;
    const indexed = {
      surface: candidate.surface,
      part: findPartById(candidate.partId),
      transformations: candidate.transformations,
    };
    const bucket = index.get(initial);
    if (bucket === undefined) index.set(initial, [indexed]);
    else bucket.push(indexed);
  }
  return index;
}

const candidateSurfaceIndex = indexCandidateSurfaces();

function legalPosition(candidate: CandidateSurface, start: number, inputLength: number): boolean {
  switch (candidate.part.kind) {
    case "prefix":
      return start === 0;
    case "suffix":
      return start + candidate.surface.length === inputLength;
    case "root":
    case "combiningForm":
      return true;
    default:
      return assertNever(candidate.part.kind);
  }
}

function unresolvedSpans(input: string, segments: readonly Segment[]): readonly UnresolvedSpan[] {
  const spans: UnresolvedSpan[] = [];
  let cursor = 0;
  for (const segment of segments) {
    if (cursor < segment.start) {
      spans.push({ start: cursor, end: segment.start, surface: input.slice(cursor, segment.start) });
    }
    cursor = segment.end;
  }
  if (cursor < input.length) {
    spans.push({ start: cursor, end: input.length, surface: input.slice(cursor) });
  }
  return spans;
}

function rank(input: string, segmentation: Segmentation): CandidateRank {
  const coveredCharacterCount = segmentation.segments.reduce(
    (total, segment) => total + segment.end - segment.start,
    0,
  );
  return {
    complete: coveredCharacterCount === input.length,
    coveredCharacterCount,
    unmatchedCharacterCount: input.length - coveredCharacterCount,
    segmentCount: segmentation.segments.length,
    leftmostLengths: segmentation.segments.map((segment) => segment.end - segment.start),
    partIds: segmentation.segments.map((segment) => segment.partId),
  };
}

function compareSegmentations(input: string, left: Segmentation, right: Segmentation): number {
  return compareCandidateRanks(rank(input, left), rank(input, right));
}

function matchingSegments(input: string, offset: number): readonly Segment[] {
  const initial = input[offset];
  if (initial === undefined) return [];
  const matches: Segment[] = [];
  for (const candidate of candidateSurfaceIndex.get(initial) ?? []) {
    if (input.startsWith(candidate.surface, offset) && legalPosition(candidate, offset, input.length)) {
      matches.push({
        start: offset,
        end: offset + candidate.surface.length,
        surface: candidate.surface,
        partId: candidate.part.id,
        notation: candidate.part.form,
        kind: candidate.part.kind,
        meaning: candidate.part.meaning,
        transformations: candidate.transformations,
        citations: candidate.part.sources,
      });
    }
  }
  return matches;
}

function legalTransformationContext(segment: Segment, tail: Segmentation): boolean {
  if (segment.transformations.length === 0) return true;
  const next = tail.segments[0];
  return next !== undefined && next.start === segment.end && next.kind === "suffix" && vowelStart.test(next.surface);
}

function candidateSegmentations(input: string): readonly Segmentation[] {
  const segmentationsByOffset: Record<number, readonly Segmentation[]> = {
    [input.length]: [{ segments: [] }],
  };
  for (let offset = input.length - 1; offset >= 0; offset -= 1) {
    const matched: Segmentation[] = [];
    for (const segment of matchingSegments(input, offset)) {
      for (const tail of segmentationBucket(segmentationsByOffset, segment.end)) {
        if (!legalTransformationContext(segment, tail)) continue;
        matched.push({ segments: [segment, ...tail.segments] });
      }
    }
    segmentationsByOffset[offset] = [...segmentationBucket(segmentationsByOffset, offset + 1), ...matched]
      .sort((left, right) => compareSegmentations(input, left, right))
      .slice(0, maximumCandidates);
  }
  return segmentationBucket(segmentationsByOffset, 0).filter((candidate) => candidate.segments.length);
}

function confidence(inputLength: number, segments: readonly Segment[]): CandidateAnalysis["confidence"] {
  const covered = segments.reduce((total, segment) => total + segment.end - segment.start, 0);
  if (covered === inputLength) return { basis: "complete_coverage", score: 0.9 };
  return { basis: "partial_coverage", score: Math.round((covered / inputLength) * 90) / 100 };
}

export function segmentTerm(input: string): readonly CandidateAnalysis[] {
  return candidateSegmentations(input).map((candidate) => ({
    confidence: confidence(input.length, candidate.segments),
    segments: candidate.segments,
    unresolvedSpans: unresolvedSpans(input, candidate.segments),
  }));
}
