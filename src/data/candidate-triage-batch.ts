import { compareCodePoints } from "./ordering";
import type { CandidateTriageCategory, CandidateTriageItem } from "./candidate-triage";
import type { CandidateReviewDecision } from "./schemas";

export type CandidateTriageUnresolvedOccurrence = {
  readonly candidateId: string;
  readonly start: number;
  readonly end: number;
};

export type CandidateTriageUnresolvedSurfaceGroup = {
  readonly surface: string;
  readonly occurrenceCount: number;
  readonly candidateCount: number;
  readonly occurrences: readonly CandidateTriageUnresolvedOccurrence[];
};

export type CandidateTriageRankedCandidate = {
  readonly rank: number;
  readonly candidateId: string;
  readonly category: CandidateTriageCategory;
  readonly knownCoveragePercent: number;
  readonly unresolvedSpanCount: number;
  readonly tinyUnresolvedSpanCount: number;
  readonly unresolvedCharacterCount: number;
  readonly sourceCount: number;
};

export type CandidateTriageBatchReview = {
  readonly unresolvedSurfaceGroups: readonly CandidateTriageUnresolvedSurfaceGroup[];
  readonly rankedCandidates: readonly CandidateTriageRankedCandidate[];
  readonly deferredCandidates: readonly CandidateTriageDeferredCandidate[];
};

export type CandidateTriageDeferredCandidate = {
  readonly candidateId: string;
  readonly reason: CandidateReviewDecision["reason"];
  readonly reviewSources: readonly string[];
  readonly note: string;
};

const rankingCategoryPriority = new Map<CandidateTriageCategory, number>([
  ["partial_known_parts", 0],
  ["no_known_parts", 1],
  ["phrase_candidate", 2],
  ["unsupported_characters", 3],
]);

function unresolvedCharacterCount(item: CandidateTriageItem): number {
  return item.unresolvedSpans.reduce((total, span) => total + span.surface.length, 0);
}

function tinyUnresolvedSpanCount(item: CandidateTriageItem): number {
  return item.unresolvedSpans.filter((span) => span.surface.length === 1).length;
}

function hasOnlyTinyUnresolvedSpans(item: CandidateTriageItem): boolean {
  return item.unresolvedSpans.length > 0 && tinyUnresolvedSpanCount(item) === item.unresolvedSpans.length;
}

function knownCharacterCount(item: CandidateTriageItem): number {
  return item.knownSegments.reduce((total, segment) => total + segment.surface.length, 0);
}

function knownCoveragePercent(item: CandidateTriageItem): number {
  if (item.normalized.length === 0) return 0;
  return Math.round((knownCharacterCount(item) / item.normalized.length) * 100);
}

function rankedCandidate(item: CandidateTriageItem, rank: number): CandidateTriageRankedCandidate {
  return {
    rank,
    candidateId: item.id,
    category: item.category,
    knownCoveragePercent: knownCoveragePercent(item),
    unresolvedSpanCount: item.unresolvedSpans.length,
    tinyUnresolvedSpanCount: tinyUnresolvedSpanCount(item),
    unresolvedCharacterCount: unresolvedCharacterCount(item),
    sourceCount: item.sources.length,
  };
}

function rankableCategory(category: CandidateTriageCategory): boolean {
  return rankingCategoryPriority.has(category);
}

function effectiveRankingPriority(item: CandidateTriageItem): number {
  const categoryPriority = rankingCategoryPriority.get(item.category) ?? Number.POSITIVE_INFINITY;
  if (item.category === "partial_known_parts" && hasOnlyTinyUnresolvedSpans(item)) return 1.5;
  return categoryPriority;
}

function compareRankableCandidates(left: CandidateTriageItem, right: CandidateTriageItem): number {
  const leftPriority = effectiveRankingPriority(left);
  const rightPriority = effectiveRankingPriority(right);
  return leftPriority - rightPriority
    || knownCoveragePercent(right) - knownCoveragePercent(left)
    || left.unresolvedSpans.length - right.unresolvedSpans.length
    || unresolvedCharacterCount(left) - unresolvedCharacterCount(right)
    || right.sources.length - left.sources.length
    || compareCodePoints(left.normalized, right.normalized)
    || compareCodePoints(left.id, right.id);
}

function unresolvedSurfaceGroups(items: readonly CandidateTriageItem[]): readonly CandidateTriageUnresolvedSurfaceGroup[] {
  const occurrencesBySurface = new Map<string, CandidateTriageUnresolvedOccurrence[]>();
  for (const item of items) {
    if (item.category !== "partial_known_parts" && item.category !== "no_known_parts") continue;
    for (const span of item.unresolvedSpans) {
      const occurrence = { candidateId: item.id, start: span.start, end: span.end };
      occurrencesBySurface.set(span.surface, [...(occurrencesBySurface.get(span.surface) ?? []), occurrence]);
    }
  }
  return [...occurrencesBySurface.entries()]
    .map(([surface, occurrences]) => {
      const sortedOccurrences = [...occurrences].sort(
        (left, right) => compareCodePoints(left.candidateId, right.candidateId) || left.start - right.start,
      );
      return {
        surface,
        occurrenceCount: sortedOccurrences.length,
        candidateCount: new Set(sortedOccurrences.map((occurrence) => occurrence.candidateId)).size,
        occurrences: sortedOccurrences,
      };
    })
    .sort(
      (left, right) => right.occurrenceCount - left.occurrenceCount
        || right.candidateCount - left.candidateCount
        || compareCodePoints(left.surface, right.surface),
    );
}

export function createCandidateTriageBatchReview(
  items: readonly CandidateTriageItem[],
  decisions: readonly CandidateReviewDecision[],
): CandidateTriageBatchReview {
  const deferredCandidateIds = new Set(decisions.map((decision) => decision.candidateId));
  const pendingItems = items.filter((item) => !deferredCandidateIds.has(item.id));
  return {
    unresolvedSurfaceGroups: unresolvedSurfaceGroups(pendingItems),
    rankedCandidates: pendingItems
      .filter((item) => rankableCategory(item.category))
      .sort(compareRankableCandidates)
      .map((item, index) => rankedCandidate(item, index + 1)),
    deferredCandidates: decisions
      .map((decision) => ({
        candidateId: decision.candidateId,
        reason: decision.reason,
        reviewSources: decision.reviewSources,
        note: decision.note,
      }))
      .sort((left, right) => compareCodePoints(left.candidateId, right.candidateId)),
  };
}
