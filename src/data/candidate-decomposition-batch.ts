import {
  createCandidateTriageReport,
  type CandidateTriageCategory,
  type CandidateTriageItem,
  type CandidateTriageSegment,
  type CandidateTriageUnresolvedSpan,
} from "./candidate-triage";
import { DataError } from "./errors";
import { compareCodePoints } from "./ordering";
import { candidateManifestWindowSize, isProtectedCandidateManifestOutputPath } from "./candidate-manifest";
import type { Corpus } from "./validate";

export type CandidateDecompositionStatus =
  | "ready_for_term_draft"
  | "needs_word_part_sources"
  | "needs_phrase_review"
  | "unsupported_characters";

export type CandidateDecompositionBatchEntry = {
  readonly candidateId: string;
  readonly term: string;
  readonly normalized: string;
  readonly category: CandidateTriageCategory;
  readonly status: CandidateDecompositionStatus;
  readonly sources: readonly string[];
  readonly sourceVersion: string;
  readonly knownSegments: readonly CandidateTriageSegment[];
  readonly unresolvedSpans: readonly CandidateTriageUnresolvedSpan[];
  readonly reviewTodo: string;
};

export type CandidateDecompositionBatch = {
  readonly schemaVersion: 1;
  readonly summary: {
    readonly candidateTermCount: number;
    readonly deferredCandidateCount: number;
    readonly reviewableCandidateCount: number;
    readonly includedCandidateCount: number;
    readonly readyForTermDraftCount: number;
    readonly needsWordPartSourcesCount: number;
    readonly needsPhraseReviewCount: number;
    readonly unsupportedCharactersCount: number;
    readonly batchSize: number;
    readonly batchNumber: number;
    readonly batchStart: number;
    readonly batchEnd: number;
    readonly remainingCandidateCount: number;
  };
  readonly candidates: readonly CandidateDecompositionBatchEntry[];
};

export type CandidateDecompositionBatchOptions = {
  readonly batchSize?: number;
  readonly batchNumber?: number;
};

type CandidateDecompositionWindow = {
  readonly candidates: readonly CandidateTriageItem[];
  readonly reviewableCandidateCount: number;
  readonly batchSize: number;
  readonly batchNumber: number;
  readonly batchStart: number;
  readonly batchEnd: number;
  readonly remainingCandidateCount: number;
};

const categoryPriority = new Map<CandidateTriageCategory, number>([
  ["complete_known_parts", 0],
  ["partial_known_parts", 1],
  ["no_known_parts", 2],
  ["phrase_candidate", 3],
  ["unsupported_characters", 4],
  ["verified_collision", 5],
]);

function decompositionStatus(category: CandidateTriageCategory): CandidateDecompositionStatus {
  switch (category) {
    case "complete_known_parts":
      return "ready_for_term_draft";
    case "partial_known_parts":
    case "no_known_parts":
      return "needs_word_part_sources";
    case "phrase_candidate":
      return "needs_phrase_review";
    case "unsupported_characters":
    case "verified_collision":
      return "unsupported_characters";
  }
}

function reviewTodo(entry: CandidateTriageItem, status: CandidateDecompositionStatus): string {
  switch (status) {
    case "ready_for_term_draft":
      return "Review the known segments, write the teaching note, and move a source-cited term record into data/terms.";
    case "needs_word_part_sources":
      return entry.knownSegments.length === 0
        ? "Find source-backed word parts before drafting the term analysis."
        : "Source and add the unresolved word parts before drafting the term analysis.";
    case "needs_phrase_review":
      return "Review phrase handling before authoring any term record; the current term schema accepts single normalized words.";
    case "unsupported_characters":
      return "Resolve unsupported spelling or verified-term collision before decomposition review.";
  }
}

function compareReviewableCandidates(left: CandidateTriageItem, right: CandidateTriageItem): number {
  return (categoryPriority.get(left.category) ?? Number.POSITIVE_INFINITY)
    - (categoryPriority.get(right.category) ?? Number.POSITIVE_INFINITY)
    || right.knownSegments.length - left.knownSegments.length
    || left.unresolvedSpans.length - right.unresolvedSpans.length
    || compareCodePoints(left.normalized, right.normalized)
    || compareCodePoints(left.id, right.id);
}

function isReviewable(item: CandidateTriageItem, deferredIds: ReadonlySet<string>): boolean {
  return !deferredIds.has(item.id) && item.category !== "verified_collision";
}

function candidateWindow(corpus: Corpus, options: CandidateDecompositionBatchOptions): CandidateDecompositionWindow {
  const report = createCandidateTriageReport(corpus);
  const deferredIds = new Set(corpus.candidateReviewDecisions.map((decision) => decision.candidateId));
  const triageItems = report.categories.flatMap((category) => category.candidates);
  const triageById = new Map(triageItems.map((item) => [item.id, item]));
  const reviewable = triageItems.filter((item) => isReviewable(item, deferredIds));
  const batchSize = options.batchSize ?? candidateManifestWindowSize;
  const batchNumber = options.batchNumber ?? 1;
  const sourceCandidates = [...corpus.candidateTerms].sort((left, right) => compareCodePoints(left.normalized, right.normalized)
    || compareCodePoints(left.id, right.id));
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > candidateManifestWindowSize) {
    throw new DataError("batch", `batch size must be between 1 and ${candidateManifestWindowSize}`);
  }
  if (!Number.isSafeInteger(batchNumber) || batchNumber < 1) {
    throw new DataError("batch", "batch number must be a positive integer");
  }
  const sourceBatchCount = Math.ceil(sourceCandidates.length / batchSize);
  if (sourceBatchCount > 0 && batchNumber > sourceBatchCount) {
    throw new DataError("batch", `batch number ${batchNumber} exceeds source batch count ${sourceBatchCount}`);
  }
  const startIndex = (batchNumber - 1) * batchSize;
  const sourceWindow = sourceCandidates.slice(startIndex, startIndex + batchSize);
  const selected = sourceWindow
    .flatMap((candidate) => {
      const item = triageById.get(candidate.id);
      return item !== undefined && isReviewable(item, deferredIds) ? [item] : [];
    })
    .sort(compareReviewableCandidates);
  const sourceEnd = startIndex + sourceWindow.length;
  const batchEnd = sourceEnd;
  const remainingCandidateCount = sourceCandidates.slice(sourceEnd)
    .flatMap((candidate) => {
      const item = triageById.get(candidate.id);
      return item !== undefined && isReviewable(item, deferredIds) ? [item] : [];
    }).length;
  return {
    candidates: selected,
    reviewableCandidateCount: reviewable.length,
    batchSize,
    batchNumber,
    batchStart: selected.length === 0 ? 0 : startIndex + 1,
    batchEnd: selected.length === 0 ? startIndex : batchEnd,
    remainingCandidateCount,
  };
}

function batchEntry(candidate: CandidateTriageItem): CandidateDecompositionBatchEntry {
  const status = decompositionStatus(candidate.category);
  return {
    candidateId: candidate.id,
    term: candidate.term,
    normalized: candidate.normalized,
    category: candidate.category,
    status,
    sources: candidate.sources,
    sourceVersion: candidate.sourceVersion,
    knownSegments: candidate.knownSegments,
    unresolvedSpans: candidate.unresolvedSpans,
    reviewTodo: reviewTodo(candidate, status),
  };
}

export function createCandidateDecompositionBatch(
  corpus: Corpus,
  options: CandidateDecompositionBatchOptions = {},
): CandidateDecompositionBatch {
  const window = candidateWindow(corpus, options);
  const candidates = window.candidates.map(batchEntry);
  return {
    schemaVersion: 1,
    summary: {
      candidateTermCount: corpus.candidateTerms.length,
      deferredCandidateCount: corpus.candidateReviewDecisions.length,
      reviewableCandidateCount: window.reviewableCandidateCount,
      includedCandidateCount: candidates.length,
      readyForTermDraftCount: candidates.filter((candidate) => candidate.status === "ready_for_term_draft").length,
      needsWordPartSourcesCount: candidates.filter((candidate) => candidate.status === "needs_word_part_sources").length,
      needsPhraseReviewCount: candidates.filter((candidate) => candidate.status === "needs_phrase_review").length,
      unsupportedCharactersCount: candidates.filter((candidate) => candidate.status === "unsupported_characters").length,
      batchSize: window.batchSize,
      batchNumber: window.batchNumber,
      batchStart: window.batchStart,
      batchEnd: window.batchEnd,
      remainingCandidateCount: window.remainingCandidateCount,
    },
    candidates,
  };
}

export function candidateDecompositionBatchJson(batch: CandidateDecompositionBatch): string {
  return `${JSON.stringify(batch, null, 2)}\n`;
}

export function isProtectedDecompositionOutputPath(outputPath: string, root = process.cwd()): boolean {
  return isProtectedCandidateManifestOutputPath(outputPath, root);
}
