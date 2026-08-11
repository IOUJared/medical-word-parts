import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { parseCandidateDecompositionBatchArtifactJson } from "./candidate-batch-artifacts";
import { candidateTermsSha256, parseCandidateManifestJson, type CandidateManifest } from "./candidate-manifest";
import { DataError, DataValidationError } from "./errors";
import { JsonFileTransactionError, recoverJsonFileTransaction, writeJsonFileTransaction, type JsonFileTransactionHooks } from "./json-file-transaction";
import { loadCorpus } from "./load";
import { compareCodePoints } from "./ordering";
import {
  candidateDispositionsDocumentSchema,
  candidateReviewDecisionsDocumentSchema,
  candidateTermsDocumentSchema,
  type CandidateDisposition,
  type CandidateReviewDecision,
  type CandidateTerm,
  type Term,
} from "./schemas";
import { validateCorpus } from "./validate";

const applyOptionsSchema = z.strictObject({
  dataDirectory: z.string().min(1),
  manifestPath: z.string().min(1),
  decompositionPath: z.string().min(1),
  expectedDecompositionSha256: z.string().regex(/^[a-f0-9]{64}$/),
  batchNumber: z.number().int().positive(),
});

export type CandidateNonPromotedApplyOptions = z.infer<typeof applyOptionsSchema>;
export type CandidateNonPromotedApplySummary = {
  readonly appliedCandidateCount: number;
  readonly removedCandidateIds: readonly string[];
  readonly dispositionCandidateIds: readonly string[];
  readonly remainingCandidateCount: number;
  readonly totalDispositionCount: number;
  readonly remainingReviewDecisionCount: number;
};

type DecompositionCandidate = ReturnType<typeof parseCandidateDecompositionBatchArtifactJson>["candidates"][number];
type ApplyPlan = {
  readonly candidateTerms: readonly CandidateTerm[];
  readonly candidateDispositions: readonly CandidateDisposition[];
  readonly candidateReviewDecisions: readonly CandidateReviewDecision[];
  readonly summary: CandidateNonPromotedApplySummary;
};

export class CandidateNonPromotedApplyError extends Error {
  override readonly name = "CandidateNonPromotedApplyError";

  constructor(readonly detail: string) {
    super(detail);
  }
}

export function parseCandidateNonPromotedApplyOptions(input: unknown): CandidateNonPromotedApplyOptions {
  return applyOptionsSchema.parse(input);
}

function sha256(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function identityMatches(candidate: CandidateTerm, entry: DecompositionCandidate): boolean {
  return candidate.term === entry.term
    && candidate.normalized === entry.normalized
    && candidate.sourceVersion === entry.sourceVersion
    && candidate.sources.length === entry.sources.length
    && candidate.sources.every((source, index) => source === entry.sources[index]);
}

function recoveredStateMatchesManifest(
  manifest: CandidateManifest,
  candidates: readonly CandidateTerm[],
  dispositions: readonly CandidateDisposition[],
): boolean {
  if (dispositions.length === 0) return false;
  const manifestById = new Map(manifest.candidates.map((candidate) => [candidate.id, candidate]));
  const recoveredIds = new Set<string>();
  for (const candidate of candidates) {
    if (manifestById.get(candidate.id)?.normalized !== candidate.normalized) return false;
    recoveredIds.add(candidate.id);
  }
  for (const disposition of dispositions) {
    if (manifestById.get(disposition.originalCandidateId)?.normalized !== disposition.originalNormalized) return false;
    recoveredIds.add(disposition.originalCandidateId);
  }
  return recoveredIds.size === manifest.candidates.length;
}

function migratedReview(candidate: CandidateTerm, review: CandidateReviewDecision): CandidateDisposition {
  switch (review.reason) {
    case "insufficient_decomposition_evidence":
      return { originalCandidateId: candidate.id, originalTerm: candidate.term, originalNormalized: candidate.normalized, outcome: "deferred_insufficient_evidence", reviewSources: review.reviewSources, note: review.note };
    case "term_schema_incompatible":
      return { originalCandidateId: candidate.id, originalTerm: candidate.term, originalNormalized: candidate.normalized, outcome: "deferred_schema_incompatible", reviewSources: review.reviewSources, note: review.note };
  }
}

function dispositionFor(candidate: CandidateTerm, entry: DecompositionCandidate, termsByNormalized: ReadonlyMap<string, Term>): CandidateDisposition {
  const identity = { originalCandidateId: candidate.id, originalTerm: candidate.term, originalNormalized: candidate.normalized, reviewSources: candidate.sources } as const;
  switch (entry.category) {
    case "complete_known_parts":
      throw new CandidateNonPromotedApplyError(`${candidate.id} is promotable; use candidate:promote:apply`);
    case "partial_known_parts":
      return { ...identity, outcome: "source_review_required", note: "Additional source-backed word parts are required to resolve the remaining spans." };
    case "no_known_parts":
      return { ...identity, outcome: "deferred_insufficient_evidence", note: "Available review sources do not establish a source-backed word-part decomposition." };
    case "phrase_candidate": {
      const existingTerm = termsByNormalized.get(candidate.normalized);
      return existingTerm === undefined
        ? { ...identity, outcome: "deferred_phrase_review", note: "This candidate is a phrase and requires review outside the single-term schema." }
        : { ...identity, outcome: "promoted_verified_term", promotedTermId: existingTerm.id, note: "The candidate resolves to an existing schema-valid verified term." };
    }
    case "verified_collision": {
      const existingTerm = termsByNormalized.get(candidate.normalized);
      if (existingTerm === undefined) throw new CandidateNonPromotedApplyError(`${candidate.id} has no schema-valid verified term`);
      return { ...identity, outcome: "promoted_verified_term", promotedTermId: existingTerm.id, note: "The candidate resolves to an existing schema-valid verified term." };
    }
    case "unsupported_characters":
      return { ...identity, outcome: "rejected_out_of_scope", note: "The spelling is outside the normalized term forms supported by the current schema." };
  }
}

function buildPlan(options: CandidateNonPromotedApplyOptions): ApplyPlan {
  const candidateTermsPath = join(options.dataDirectory, "candidate-terms.json");
  const candidateTermsBytes = readFileSync(candidateTermsPath);
  const decompositionJson = readFileSync(options.decompositionPath, "utf8");
  if (sha256(decompositionJson) !== options.expectedDecompositionSha256) {
    throw new CandidateNonPromotedApplyError("decomposition batch hash drifted");
  }
  const manifest = parseCandidateManifestJson(readFileSync(options.manifestPath, "utf8"));
  const decomposition = parseCandidateDecompositionBatchArtifactJson(decompositionJson);
  const window = manifest.windows[options.batchNumber - 1];
  if (window === undefined) throw new CandidateNonPromotedApplyError(`manifest has no batch ${options.batchNumber}`);
  if (decomposition.summary.batchNumber !== options.batchNumber) {
    throw new CandidateNonPromotedApplyError("decomposition batch number does not match apply batch");
  }
  const corpus = loadCorpus(options.dataDirectory);
  const activeCandidates = corpus.candidateTerms.map((record) => record.value);
  const existingDispositions = corpus.candidateDispositions.map((record) => record.value);
  if (manifest.source.candidateTermsSha256 !== candidateTermsSha256(candidateTermsBytes)
    && !recoveredStateMatchesManifest(manifest, activeCandidates, existingDispositions)) {
    throw new CandidateNonPromotedApplyError("candidate source hash drifted from frozen manifest");
  }
  const dispositionById = new Map(existingDispositions.map((disposition) => [disposition.originalCandidateId, disposition]));
  for (const previousWindow of manifest.windows.slice(0, options.batchNumber - 1)) {
    if (previousWindow.candidateIds.some((candidateId) => !dispositionById.has(candidateId))) {
      throw new CandidateNonPromotedApplyError(`batch ${previousWindow.batchNumber} must be completed before batch ${options.batchNumber}`);
    }
  }
  const windowIds = new Set(window.candidateIds);
  const decompositionById = new Map<string, DecompositionCandidate>();
  for (const entry of decomposition.candidates) {
    if (!windowIds.has(entry.candidateId)) throw new CandidateNonPromotedApplyError(`${entry.candidateId} is outside manifest batch ${options.batchNumber}`);
    decompositionById.set(entry.candidateId, entry);
  }
  const activeById = new Map(activeCandidates.map((candidate) => [candidate.id, candidate]));
  const reviewById = new Map(corpus.candidateReviewDecisions.map((record) => [record.value.candidateId, record.value]));
  const termsByNormalized = new Map(corpus.terms.map((record) => [record.value.normalized, record.value]));
  const plannedDispositions: CandidateDisposition[] = [];
  const finalizedIds = new Set<string>();
  for (const candidateId of window.candidateIds) {
    const candidate = activeById.get(candidateId);
    const existingDisposition = dispositionById.get(candidateId);
    if (existingDisposition !== undefined) {
      if (candidate !== undefined && (candidate.term !== existingDisposition.originalTerm || candidate.normalized !== existingDisposition.originalNormalized)) {
        throw new CandidateNonPromotedApplyError(`${candidateId} disposition identity does not match active candidate`);
      }
      finalizedIds.add(candidateId);
      continue;
    }
    if (candidate === undefined) throw new CandidateNonPromotedApplyError(`${candidateId} is missing from active candidates and dispositions`);
    const review = reviewById.get(candidateId);
    if (review !== undefined) {
      plannedDispositions.push(migratedReview(candidate, review));
      finalizedIds.add(candidateId);
      continue;
    }
    const entry = decompositionById.get(candidateId);
    if (entry === undefined) {
      throw new CandidateNonPromotedApplyError(`${candidateId} is missing from decomposition batch ${options.batchNumber}`);
    }
    if (!identityMatches(candidate, entry)) throw new CandidateNonPromotedApplyError(`${candidateId} decomposition does not match active candidate`);
    plannedDispositions.push(dispositionFor(candidate, entry, termsByNormalized));
    finalizedIds.add(candidateId);
  }
  const candidateTerms = activeCandidates.filter((candidate) => !finalizedIds.has(candidate.id));
  const candidateReviewDecisions = corpus.candidateReviewDecisions.map((record) => record.value).filter((review) => !finalizedIds.has(review.candidateId));
  const candidateDispositions = [...existingDispositions, ...plannedDispositions].sort((left, right) => compareCodePoints(left.originalCandidateId, right.originalCandidateId));
  return {
    candidateTerms,
    candidateDispositions,
    candidateReviewDecisions,
    summary: {
      appliedCandidateCount: plannedDispositions.length,
      removedCandidateIds: activeCandidates.filter((candidate) => finalizedIds.has(candidate.id)).map((candidate) => candidate.id),
      dispositionCandidateIds: plannedDispositions.map((disposition) => disposition.originalCandidateId),
      remainingCandidateCount: candidateTerms.length,
      totalDispositionCount: candidateDispositions.length,
      remainingReviewDecisionCount: candidateReviewDecisions.length,
    },
  };
}

function writePlan(dataDirectory: string, plan: ApplyPlan, hooks: JsonFileTransactionHooks): void {
  if (plan.summary.appliedCandidateCount === 0 && plan.summary.removedCandidateIds.length === 0) return;
  writeJsonFileTransaction(dataDirectory, [
    { relativePath: "candidate-dispositions.json", content: `${JSON.stringify(candidateDispositionsDocumentSchema.parse({ candidateDispositions: plan.candidateDispositions }), null, 2)}\n` },
    { relativePath: "candidate-review-decisions.json", content: `${JSON.stringify(candidateReviewDecisionsDocumentSchema.parse({ candidateReviewDecisions: plan.candidateReviewDecisions }), null, 2)}\n` },
    { relativePath: "candidate-terms.json", content: `${JSON.stringify(candidateTermsDocumentSchema.parse({ candidateTerms: plan.candidateTerms }), null, 2)}\n` },
  ], hooks);
}

export function applyCandidateNonPromotedDispositions(input: CandidateNonPromotedApplyOptions, hooks: JsonFileTransactionHooks = {}): CandidateNonPromotedApplySummary {
  const options = parseCandidateNonPromotedApplyOptions(input);
  try {
    recoverJsonFileTransaction(options.dataDirectory);
    const plan = buildPlan(options);
    validateCorpus({
      ...loadCorpus(options.dataDirectory),
      candidateTerms: plan.candidateTerms.map((value) => ({ path: "candidate-terms.json", value })),
      candidateDispositions: plan.candidateDispositions.map((value) => ({ path: "candidate-dispositions.json", value })),
      candidateReviewDecisions: plan.candidateReviewDecisions.map((value) => ({ path: "candidate-review-decisions.json", value })),
    });
    writePlan(options.dataDirectory, plan, hooks);
    return plan.summary;
  } catch (error) {
    if (error instanceof CandidateNonPromotedApplyError || error instanceof DataError || error instanceof DataValidationError) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new CandidateNonPromotedApplyError(error.message);
    if (error instanceof JsonFileTransactionError) throw new CandidateNonPromotedApplyError(error.message);
    throw error;
  }
}

export function candidateNonPromotedApplySummaryJson(summary: CandidateNonPromotedApplySummary): string {
  return `${JSON.stringify(summary)}\n`;
}
