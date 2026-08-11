import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { DataError, DataValidationError } from "./errors";
import { loadCorpus, type Located } from "./load";
import { candidateTermsSha256, parseCandidateManifestJson, type CandidateManifest } from "./candidate-manifest";
import { parseCandidateDecompositionBatchArtifactJson } from "./candidate-batch-artifacts";
import { JsonFileTransactionError, recoverJsonFileTransaction, writeJsonFileTransaction, type JsonFileTransactionHooks } from "./json-file-transaction";
import { compareCodePoints } from "./ordering";
import {
  candidateDispositionsDocumentSchema,
  candidateReviewDecisionsDocumentSchema,
  candidateTermsDocumentSchema,
  termSchema,
  type CandidateDisposition,
  type CandidateReviewDecision,
  type CandidateTerm,
  type Term,
} from "./schemas";
import { validateCorpus } from "./validate";
const promotionApplyOptionsSchema = z.strictObject({ dataDirectory: z.string().min(1), manifestPath: z.string().min(1), decompositionPath: z.string().min(1), expectedDecompositionSha256: z.string().regex(/^[a-f0-9]{64}$/) });

export type CandidatePromotionApplyOptions = z.infer<typeof promotionApplyOptionsSchema>;

export type CandidatePromotionApplySummary = {
  readonly promotedCandidateCount: number;
  readonly createdTermIds: readonly string[];
  readonly removedCandidateIds: readonly string[];
  readonly dispositionCandidateIds: readonly string[];
};

type PromotionPlan = { readonly terms: readonly Term[]; readonly candidateTerms: readonly CandidateTerm[]; readonly candidateDispositions: readonly CandidateDisposition[]; readonly candidateReviewDecisions: readonly CandidateReviewDecision[]; readonly finalizedCandidateIds: readonly string[]; readonly summary: CandidatePromotionApplySummary };

export class CandidatePromotionApplyError extends Error {
  override readonly name = "CandidatePromotionApplyError";

  constructor(readonly detail: string) {
    super(detail);
  }
}

export function parseCandidatePromotionApplyOptions(input: unknown): CandidatePromotionApplyOptions {
  return promotionApplyOptionsSchema.parse(input);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function slugFromNormalized(normalized: string): string {
  return normalized.replaceAll(" ", "-");
}

function finalTerm(candidate: { readonly candidateId: string; readonly normalized: string; readonly sources: readonly string[]; readonly knownSegments: Term["analyses"][number]["segments"] }): Term {
  const slug = slugFromNormalized(candidate.normalized);
  return termSchema.parse({
    id: `term:${slug}`,
    slug,
    term: candidate.normalized,
    normalized: candidate.normalized,
    sources: candidate.sources,
    note: `Source-backed word-part analysis promoted from ${candidate.candidateId}.`,
    analyses: [{ id: `analysis:${slug}-primary`, primary: true, segments: candidate.knownSegments }],
  });
}

function dispositionFor(candidate: CandidateTerm, termId: string): CandidateDisposition {
  return {
    originalCandidateId: candidate.id,
    originalTerm: candidate.term,
    originalNormalized: candidate.normalized,
    outcome: "promoted_verified_term",
    promotedTermId: termId,
    reviewSources: candidate.sources,
    note: "Promoted from a complete decomposition with existing source-backed word parts.",
  };
}

function hasSameSources(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((source, index) => source === right[index]);
}

function matchesActiveCandidate(
  active: CandidateTerm,
  candidate: ReturnType<typeof parseCandidateDecompositionBatchArtifactJson>["candidates"][number],
): boolean {
  return active.term === candidate.term
    && active.normalized === candidate.normalized
    && hasSameSources(active.sources, candidate.sources);
}

function matchesPromotion(candidate: CandidateTerm, term: Term, disposition: CandidateDisposition | undefined): boolean {
  return disposition?.outcome === "promoted_verified_term"
    && disposition.promotedTermId === term.id
    && disposition.originalCandidateId === candidate.id
    && disposition.originalTerm === candidate.term
    && disposition.originalNormalized === candidate.normalized
    && hasSameSources(disposition.reviewSources, candidate.sources);
}

function snapshotCandidate(candidate: ReturnType<typeof parseCandidateDecompositionBatchArtifactJson>["candidates"][number]): CandidateTerm {
  return {
    id: candidate.candidateId,
    term: candidate.term,
    normalized: candidate.normalized,
    status: "candidate",
    sources: candidate.sources,
    sourceVersion: candidate.sourceVersion,
    license: "frozen manifest promotion",
  };
}

function activeCandidatesMatchManifestAfterRecovery(
  activeCandidates: readonly CandidateTerm[],
  manifest: CandidateManifest,
  recoveredCandidateIds: ReadonlySet<string>,
): boolean {
  if (activeCandidates.length + recoveredCandidateIds.size !== manifest.candidates.length) return false;
  const frozenCandidatesById = new Map(manifest.candidates.map((candidate) => [candidate.id, candidate]));
  return activeCandidates.every((candidate) => {
    const frozenCandidate = frozenCandidatesById.get(candidate.id);
    return !recoveredCandidateIds.has(candidate.id) && frozenCandidate?.normalized === candidate.normalized;
  });
}

function matchesTerm(left: Term, right: Term): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertBatchCandidateIsPromotable(candidate: ReturnType<typeof parseCandidateDecompositionBatchArtifactJson>["candidates"][number]): void {
  if (candidate.status !== "ready_for_term_draft" || candidate.category !== "complete_known_parts" || candidate.unresolvedSpans.length > 0) {
    throw new CandidatePromotionApplyError(`${candidate.candidateId} is not promotable`);
  }
}

function validatePlan(
  dataDirectory: string,
  sourceTerms: readonly Located<Term>[],
  plan: PromotionPlan,
): void {
  const locatedTerms = [
    ...sourceTerms,
    ...plan.terms.map((value) => ({ path: `terms/${value.slug}.json`, value })),
  ];
  validateCorpus({
    ...loadCorpus(dataDirectory),
    terms: locatedTerms,
    candidateTerms: plan.candidateTerms.map((value) => ({ path: "candidate-terms.json", value })),
    candidateDispositions: plan.candidateDispositions.map((value) => ({ path: "candidate-dispositions.json", value })),
    candidateReviewDecisions: plan.candidateReviewDecisions.map((value) => ({ path: "candidate-review-decisions.json", value })),
  });
}

function buildPlan(options: CandidatePromotionApplyOptions): PromotionPlan {
  const dataDirectory = options.dataDirectory;
  const candidateTermsPath = join(dataDirectory, "candidate-terms.json");
  const decompositionJson = readFileSync(options.decompositionPath, "utf8");
  if (sha256(decompositionJson) !== options.expectedDecompositionSha256) {
    throw new CandidatePromotionApplyError("decomposition batch hash drifted");
  }
  const manifest = parseCandidateManifestJson(readFileSync(options.manifestPath, "utf8"));
  const currentCandidateTermsBytes = readFileSync(candidateTermsPath);
  const decomposition = parseCandidateDecompositionBatchArtifactJson(decompositionJson);
  const loaded = loadCorpus(dataDirectory);
  const activeCandidates = loaded.candidateTerms.map((record) => record.value);
  const existingTerms = loaded.terms.map((record) => record.value);
  const existingDispositions = loaded.candidateDispositions.map((record) => record.value);
  const existingReviewDecisions = loaded.candidateReviewDecisions.map((record) => record.value);
  const parts = loaded.parts.map((record) => record.value);
  const activeById = new Map(activeCandidates.map((candidate) => [candidate.id, candidate]));
  const termsById = new Map(existingTerms.map((term) => [term.id, term]));
  const termNormalized = new Set(existingTerms.map((term) => term.normalized));
  const partIds = new Set(parts.map((part) => part.id));
  const manifestIds = new Set(manifest.candidates.map((candidate) => candidate.id));
  const plannedTerms: Term[] = [];
  const plannedDispositions: CandidateDisposition[] = [];
  const removedCandidateIds: string[] = [];
  const finalizedCandidateIds: string[] = [];
  const recoveredCandidateIds = new Set<string>();
  const dispositionsByCandidateId = new Map(existingDispositions.map((disposition) => [disposition.originalCandidateId, disposition]));
  const sourceMatchesManifest = manifest.source.candidateTermsSha256 === candidateTermsSha256(currentCandidateTermsBytes);
  for (const candidate of decomposition.candidates) {
    assertBatchCandidateIsPromotable(candidate);
    if (!manifestIds.has(candidate.candidateId)) throw new CandidatePromotionApplyError(`${candidate.candidateId} is not frozen in manifest`);
    const active = activeById.get(candidate.candidateId);
    const term = finalTerm(candidate);
    const existingTerm = termsById.get(term.id);
    const existingDisposition = dispositionsByCandidateId.get(candidate.candidateId);
    if (!sourceMatchesManifest) {
      const frozenCandidate = manifest.candidates.find((entry) => entry.id === candidate.candidateId);
      if (frozenCandidate?.normalized !== candidate.normalized || active !== undefined || existingTerm === undefined || !matchesTerm(existingTerm, term)) {
        throw new CandidatePromotionApplyError("candidate source hash drifted from frozen manifest");
      }
      const completedCandidate = snapshotCandidate(candidate);
      if (existingDisposition !== undefined && !matchesPromotion(completedCandidate, term, existingDisposition)) {
        throw new CandidatePromotionApplyError("candidate source hash drifted from frozen manifest");
      }
      if (existingDisposition === undefined) plannedDispositions.push(dispositionFor(completedCandidate, term.id));
      recoveredCandidateIds.add(candidate.candidateId);
      if (existingDisposition === undefined || existingReviewDecisions.some((decision) => decision.candidateId === candidate.candidateId)) {
        finalizedCandidateIds.push(candidate.candidateId);
      }
      continue;
    }
    if (active === undefined) throw new CandidatePromotionApplyError(`${candidate.candidateId} is not active`);
    if (!matchesActiveCandidate(active, candidate)) {
      throw new CandidatePromotionApplyError(`${candidate.candidateId} decomposition does not match active candidate`);
    }
    if ((existingTerm !== undefined && !matchesTerm(existingTerm, term))
      || (existingTerm === undefined && (termNormalized.has(term.normalized) || existsSync(join(dataDirectory, "terms", `${term.slug}.json`))))) {
      throw new CandidatePromotionApplyError(`${candidate.candidateId} collides with ${term.id}`);
    }
    for (const segment of candidate.knownSegments) {
      if (!partIds.has(segment.partId)) throw new CandidatePromotionApplyError(`${candidate.candidateId} references missing part ${segment.partId}`);
    }
    if (existingTerm === undefined) plannedTerms.push(term);
    if (existingDisposition === undefined) {
      plannedDispositions.push(dispositionFor(active, term.id));
    } else if (!matchesPromotion(active, term, existingDisposition)) {
      throw new CandidatePromotionApplyError(`${candidate.candidateId} already has a different disposition`);
    }
    removedCandidateIds.push(candidate.candidateId);
    finalizedCandidateIds.push(candidate.candidateId);
  }
  if (!sourceMatchesManifest && !activeCandidatesMatchManifestAfterRecovery(activeCandidates, manifest, recoveredCandidateIds)) {
    throw new CandidatePromotionApplyError("candidate source hash drifted from frozen manifest");
  }
  const removed = new Set(removedCandidateIds);
  const finalized = new Set(finalizedCandidateIds);
  const candidateTerms = activeCandidates.filter((candidate) => !removed.has(candidate.id));
  const candidateReviewDecisions = existingReviewDecisions.filter((decision) => !finalized.has(decision.candidateId));
  const candidateDispositions = [...existingDispositions, ...plannedDispositions].sort((left, right) => compareCodePoints(left.originalCandidateId, right.originalCandidateId));
  const summary = {
    promotedCandidateCount: plannedTerms.length,
    createdTermIds: plannedTerms.map((term) => term.id),
    removedCandidateIds,
    dispositionCandidateIds: plannedDispositions.map((disposition) => disposition.originalCandidateId),
  };
  return { terms: plannedTerms, candidateTerms, candidateDispositions, candidateReviewDecisions, finalizedCandidateIds, summary };
}

function writePlan(dataDirectory: string, plan: PromotionPlan, hooks: JsonFileTransactionHooks): void {
  if (plan.summary.removedCandidateIds.length === 0 && plan.summary.dispositionCandidateIds.length === 0 && plan.finalizedCandidateIds.length === 0) return;
  writeJsonFileTransaction(dataDirectory, [
    ...plan.terms.map((term) => ({ relativePath: `terms/${term.slug}.json`, content: `${JSON.stringify(term, null, 2)}\n` })),
    { relativePath: "candidate-dispositions.json", content: `${JSON.stringify(candidateDispositionsDocumentSchema.parse({ candidateDispositions: plan.candidateDispositions }), null, 2)}\n` },
    { relativePath: "candidate-review-decisions.json", content: `${JSON.stringify(candidateReviewDecisionsDocumentSchema.parse({ candidateReviewDecisions: plan.candidateReviewDecisions }), null, 2)}\n` },
    { relativePath: "candidate-terms.json", content: `${JSON.stringify(candidateTermsDocumentSchema.parse({ candidateTerms: plan.candidateTerms }), null, 2)}\n` },
  ], hooks);
}

export function applyCandidatePromotions(input: CandidatePromotionApplyOptions, hooks: JsonFileTransactionHooks = {}): CandidatePromotionApplySummary {
  const options = parseCandidatePromotionApplyOptions(input);
  try {
    recoverJsonFileTransaction(options.dataDirectory);
    const loaded = loadCorpus(options.dataDirectory);
    const plan = buildPlan(options);
    validatePlan(options.dataDirectory, loaded.terms, plan);
    writePlan(options.dataDirectory, plan, hooks);
    return plan.summary;
  } catch (error) {
    if (error instanceof DataError || error instanceof DataValidationError || error instanceof CandidatePromotionApplyError) throw error;
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new CandidatePromotionApplyError(error.message);
    if (error instanceof JsonFileTransactionError) throw new CandidatePromotionApplyError(error.message);
    throw error;
  }
}

export function candidatePromotionApplySummaryJson(summary: CandidatePromotionApplySummary): string {
  return `${JSON.stringify(summary)}\n`;
}
