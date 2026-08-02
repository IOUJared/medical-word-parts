import { resolve, relative, sep } from "node:path";

import type { CandidateTerm, Part } from "./schemas";
import type { Corpus } from "./validate";
import { compareCodePoints } from "./ordering";
import { createCandidateTriageBatchReview, type CandidateTriageBatchReview } from "./candidate-triage-batch";

export const candidateTriageCategories = [
  "verified_collision",
  "complete_known_parts",
  "partial_known_parts",
  "no_known_parts",
  "phrase_candidate",
  "unsupported_characters",
] as const;

export type CandidateTriageCategory = (typeof candidateTriageCategories)[number];

export type CandidateTriageSegment = {
  readonly partId: string;
  readonly surface: string;
  readonly start: number;
  readonly end: number;
};

export type CandidateTriageUnresolvedSpan = {
  readonly surface: string;
  readonly start: number;
  readonly end: number;
};

export type CandidateTriageItem = {
  readonly id: string;
  readonly term: string;
  readonly normalized: string;
  readonly category: CandidateTriageCategory;
  readonly sources: readonly string[];
  readonly sourceVersion: string;
  readonly knownSegments: readonly CandidateTriageSegment[];
  readonly unresolvedSpans: readonly CandidateTriageUnresolvedSpan[];
};

export type CandidateTriageGroup = {
  readonly category: CandidateTriageCategory;
  readonly candidates: readonly CandidateTriageItem[];
};

export type CandidateVerificationTriageReport = {
  readonly schemaVersion: 3;
  readonly summary: {
    readonly verifiedTermCount: number;
    readonly candidateTermCount: number;
    readonly pendingReviewCandidateCount: number;
    readonly deferredCandidateCount: number;
    readonly categoryCounts: Record<CandidateTriageCategory, number>;
  };
  readonly categories: readonly CandidateTriageGroup[];
  readonly batchReview: CandidateTriageBatchReview;
};

type PartSurface = {
  readonly partId: string;
  readonly surface: string;
};

type Segmentation = {
  readonly knownSegments: readonly CandidateTriageSegment[];
  readonly unresolvedSpans: readonly CandidateTriageUnresolvedSpan[];
};

function partSurface(part: Part): string {
  return part.form.replaceAll("-", "").replaceAll("/", "");
}

function partSurfaces(parts: readonly Part[]): readonly PartSurface[] {
  return parts
    .map((part) => ({ partId: part.id, surface: partSurface(part) }))
    .filter((part) => part.surface.length > 0)
    .sort((left, right) => right.surface.length - left.surface.length || compareCodePoints(left.partId, right.partId));
}

function completeSegments(normalized: string, parts: readonly PartSurface[]): readonly CandidateTriageSegment[] | undefined {
  const memo = new Map<number, readonly CandidateTriageSegment[] | undefined>();
  function segmentFrom(start: number): readonly CandidateTriageSegment[] | undefined {
    if (start === normalized.length) return [];
    if (memo.has(start)) return memo.get(start);
    for (const part of parts) {
      if (!normalized.startsWith(part.surface, start)) continue;
      const end = start + part.surface.length;
      const rest = segmentFrom(end);
      if (rest !== undefined) {
        const segments = [{ partId: part.partId, surface: part.surface, start, end }, ...rest];
        memo.set(start, segments);
        return segments;
      }
    }
    memo.set(start, undefined);
    return undefined;
  }
  return segmentFrom(0);
}

function partialSegments(normalized: string, parts: readonly PartSurface[]): Segmentation {
  const knownSegments: CandidateTriageSegment[] = [];
  const unresolvedSpans: CandidateTriageUnresolvedSpan[] = [];
  let index = 0;
  while (index < normalized.length) {
    const matched = parts.find((part) => normalized.startsWith(part.surface, index));
    if (matched !== undefined) {
      const end = index + matched.surface.length;
      knownSegments.push({ partId: matched.partId, surface: matched.surface, start: index, end });
      index = end;
      continue;
    }
    const start = index;
    index += 1;
    while (index < normalized.length && parts.every((part) => !normalized.startsWith(part.surface, index))) index += 1;
    unresolvedSpans.push({ surface: normalized.slice(start, index), start, end: index });
  }
  return { knownSegments, unresolvedSpans };
}

function categoryForCandidate(
  candidate: CandidateTerm,
  normalizedVerifiedTerms: ReadonlySet<string>,
  segmentation: Segmentation,
): CandidateTriageCategory {
  if (normalizedVerifiedTerms.has(candidate.normalized)) return "verified_collision";
  if (candidate.normalized.includes(" ") || candidate.normalized.includes("-")) return "phrase_candidate";
  if (!/^[a-z]+$/.test(candidate.normalized)) return "unsupported_characters";
  if (segmentation.knownSegments.length > 0 && segmentation.unresolvedSpans.length === 0) return "complete_known_parts";
  if (segmentation.knownSegments.length > 0) return "partial_known_parts";
  return "no_known_parts";
}

function candidateItem(
  candidate: CandidateTerm,
  normalizedVerifiedTerms: ReadonlySet<string>,
  parts: readonly PartSurface[],
): CandidateTriageItem {
  const complete = /^[a-z]+$/.test(candidate.normalized) ? completeSegments(candidate.normalized, parts) : undefined;
  const segmentation = complete === undefined
    ? /^[a-z]+$/.test(candidate.normalized)
      ? partialSegments(candidate.normalized, parts)
      : { knownSegments: [], unresolvedSpans: [{ surface: candidate.normalized, start: 0, end: candidate.normalized.length }] }
    : { knownSegments: complete, unresolvedSpans: [] };
  const category = categoryForCandidate(candidate, normalizedVerifiedTerms, segmentation);
  return {
    id: candidate.id,
    term: candidate.term,
    normalized: candidate.normalized,
    category,
    sources: candidate.sources,
    sourceVersion: candidate.sourceVersion,
    knownSegments: segmentation.knownSegments,
    unresolvedSpans: segmentation.unresolvedSpans,
  };
}

function emptyCategoryCounts(): Record<CandidateTriageCategory, number> {
  return {
    verified_collision: 0,
    complete_known_parts: 0,
    partial_known_parts: 0,
    no_known_parts: 0,
    phrase_candidate: 0,
    unsupported_characters: 0,
  };
}

export function createCandidateTriageReport(corpus: Corpus): CandidateVerificationTriageReport {
  const normalizedVerifiedTerms = new Set(corpus.terms.map((term) => term.normalized));
  const surfaces = partSurfaces(corpus.parts);
  const items = corpus.candidateTerms
    .map((candidate) => candidateItem(candidate, normalizedVerifiedTerms, surfaces))
    .sort((left, right) => compareCodePoints(left.normalized, right.normalized) || compareCodePoints(left.id, right.id));
  const categoryCounts = emptyCategoryCounts();
  for (const item of items) categoryCounts[item.category] += 1;
  const batchReview = createCandidateTriageBatchReview(items, corpus.candidateReviewDecisions);
  return {
    schemaVersion: 3,
    summary: {
      verifiedTermCount: corpus.terms.length,
      candidateTermCount: corpus.candidateTerms.length,
      pendingReviewCandidateCount: corpus.candidateTerms.length - batchReview.deferredCandidates.length,
      deferredCandidateCount: batchReview.deferredCandidates.length,
      categoryCounts,
    },
    categories: candidateTriageCategories.map((category) => ({
      category,
      candidates: items.filter((item) => item.category === category),
    })),
    batchReview,
  };
}

export function candidateTriageReportJson(report: CandidateVerificationTriageReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function isWithin(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !relativePath.startsWith(sep));
}

export function isProtectedTriageOutputPath(outputPath: string, root = process.cwd()): boolean {
  const output = resolve(root, outputPath);
  return ["data", "src/generated", "public/generated"].some((path) => isWithin(resolve(root, path), output));
}
