import { z } from "zod";

import { candidateManifestWindowSize } from "./candidate-manifest";

const definitionSummarySchema = z.strictObject({
  candidateTermCount: z.number().int().nonnegative(),
  deferredCandidateCount: z.number().int().nonnegative(),
  includedCandidateCount: z.number().int().nonnegative(),
  meshDefinitionCount: z.number().int().nonnegative(),
  sourceReviewLeadCount: z.number().int().nonnegative(),
  failedDefinitionCount: z.number().int().nonnegative(),
  batchSize: z.number().int().positive().max(candidateManifestWindowSize),
  batchNumber: z.number().int().positive(),
  batchStart: z.number().int().nonnegative(),
  batchEnd: z.number().int().nonnegative(),
  remainingCandidateCount: z.number().int().nonnegative(),
});

const definitionBase = {
  candidateId: z.string().regex(/^candidate:[a-z0-9-]+$/),
  term: z.string().min(1),
  normalized: z.string().min(1),
  candidateSources: z.array(z.string().min(1)).min(1),
} as const;

const definitionCandidateSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...definitionBase,
    status: z.literal("mesh_definition"),
    sourceVersion: z.string().min(1),
    definition: z.strictObject({ sourceId: z.literal("source:mesh-terms"), sourceName: z.string().min(1), descriptorId: z.string().min(1), descriptorLabel: z.string().min(1), conceptId: z.string().min(1), text: z.string().min(1), url: z.url() }),
  }),
  z.strictObject({
    ...definitionBase,
    status: z.literal("source_review_required"),
    sourceLeads: z.array(z.strictObject({ sourceId: z.string().min(1), sourceName: z.string().min(1), url: z.url() })).min(1),
  }),
  z.strictObject({
    ...definitionBase,
    status: z.literal("definition_fetch_failed"),
    sourceVersion: z.string().min(1),
    descriptorId: z.string().min(1),
    error: z.string().min(1),
  }),
]);

const decompositionSpanSchema = z.strictObject({ surface: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive() })
  .refine((span) => span.start < span.end, "span end must follow its start");

const decompositionSummarySchema = z.strictObject({
  candidateTermCount: z.number().int().nonnegative(), deferredCandidateCount: z.number().int().nonnegative(), reviewableCandidateCount: z.number().int().nonnegative(), includedCandidateCount: z.number().int().nonnegative(), readyForTermDraftCount: z.number().int().nonnegative(), needsWordPartSourcesCount: z.number().int().nonnegative(), needsPhraseReviewCount: z.number().int().nonnegative(), unsupportedCharactersCount: z.number().int().nonnegative(), batchSize: z.number().int().positive().max(candidateManifestWindowSize), batchNumber: z.number().int().positive(), batchStart: z.number().int().nonnegative(), batchEnd: z.number().int().nonnegative(), remainingCandidateCount: z.number().int().nonnegative(),
});

const decompositionCandidateSchema = z.strictObject({
  candidateId: z.string().regex(/^candidate:[a-z0-9-]+$/), term: z.string().min(1), normalized: z.string().min(1), category: z.enum(["complete_known_parts", "partial_known_parts", "no_known_parts", "phrase_candidate", "unsupported_characters", "verified_collision"]), status: z.enum(["ready_for_term_draft", "needs_word_part_sources", "needs_phrase_review", "unsupported_characters"]), sources: z.array(z.string().min(1)).min(1), sourceVersion: z.string().min(1), knownSegments: z.array(decompositionSpanSchema.extend({ partId: z.string().min(1) })), unresolvedSpans: z.array(decompositionSpanSchema), reviewTodo: z.string().min(1),
});

function uniqueCandidateIds(candidates: readonly { readonly candidateId: string }[]): boolean {
  return new Set(candidates.map((candidate) => candidate.candidateId)).size === candidates.length;
}

const candidateDefinitionBatchArtifactSchema = z.strictObject({ schemaVersion: z.literal(1), summary: definitionSummarySchema, candidates: z.array(definitionCandidateSchema).max(candidateManifestWindowSize) })
  .refine((batch) => batch.summary.includedCandidateCount === batch.candidates.length, "included candidate count must equal candidate entries")
  .refine((batch) => uniqueCandidateIds(batch.candidates), "candidate IDs must be unique");

const candidateDecompositionBatchArtifactSchema = z.strictObject({ schemaVersion: z.literal(1), summary: decompositionSummarySchema, candidates: z.array(decompositionCandidateSchema).max(candidateManifestWindowSize) })
  .refine((batch) => batch.summary.includedCandidateCount === batch.candidates.length, "included candidate count must equal candidate entries")
  .refine((batch) => uniqueCandidateIds(batch.candidates), "candidate IDs must be unique");

export type SavedCandidateDefinitionBatchArtifact = z.infer<typeof candidateDefinitionBatchArtifactSchema>;
export type SavedCandidateDecompositionBatchArtifact = z.infer<typeof candidateDecompositionBatchArtifactSchema>;

export function parseCandidateDefinitionBatchArtifactJson(body: string): SavedCandidateDefinitionBatchArtifact {
  return candidateDefinitionBatchArtifactSchema.parse(JSON.parse(body));
}

export function parseCandidateDecompositionBatchArtifactJson(body: string): SavedCandidateDecompositionBatchArtifact {
  return candidateDecompositionBatchArtifactSchema.parse(JSON.parse(body));
}
