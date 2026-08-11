import { z } from "zod";

const candidateDecompositionStatusSchema = z.enum([
  "ready_for_term_draft",
  "needs_word_part_sources",
  "needs_phrase_review",
  "unsupported_characters",
]);

const candidateTriageCategorySchema = z.enum([
  "complete_known_parts",
  "partial_known_parts",
  "no_known_parts",
  "phrase_candidate",
  "unsupported_characters",
  "verified_collision",
]);

const decompositionSpanSchema = z.object({
  surface: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
}).refine((span) => span.start < span.end, "span end must follow its start");

const knownSegmentSchema = decompositionSpanSchema.extend({
  partId: z.string().min(1),
});

const candidateDecompositionBatchSummarySchema = z.object({
  candidateTermCount: z.number().int().nonnegative(),
  deferredCandidateCount: z.number().int().nonnegative(),
  reviewableCandidateCount: z.number().int().nonnegative(),
  includedCandidateCount: z.number().int().nonnegative(),
  readyForTermDraftCount: z.number().int().nonnegative(),
  needsWordPartSourcesCount: z.number().int().nonnegative(),
  needsPhraseReviewCount: z.number().int().nonnegative(),
  unsupportedCharactersCount: z.number().int().nonnegative(),
  batchSize: z.number().int().positive(),
  batchNumber: z.number().int().positive(),
  batchStart: z.number().int().nonnegative(),
  batchEnd: z.number().int().nonnegative(),
  remainingCandidateCount: z.number().int().nonnegative(),
}).strict();

const candidateDecompositionBatchDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  summary: candidateDecompositionBatchSummarySchema,
  candidates: z.array(z.object({
    candidateId: z.string().min(1),
    term: z.string().min(1),
    normalized: z.string().min(1),
    category: candidateTriageCategorySchema,
    status: candidateDecompositionStatusSchema,
    sources: z.array(z.string().min(1)).min(1),
    sourceVersion: z.string().min(1),
    knownSegments: z.array(knownSegmentSchema),
    unresolvedSpans: z.array(decompositionSpanSchema),
    reviewTodo: z.string().min(1),
  }).strict()),
}).strict().refine(
  (batch) => batch.summary.includedCandidateCount === batch.candidates.length,
  "included candidate count must equal candidate entries",
).refine(
  (batch) => new Set(batch.candidates.map((candidate) => candidate.candidateId)).size === batch.candidates.length,
  "candidate IDs must be unique",
);

export type SavedCandidateDecompositionBatch = z.infer<typeof candidateDecompositionBatchDocumentSchema>;

export function parseCandidateDecompositionBatchJson(body: string): SavedCandidateDecompositionBatch {
  return candidateDecompositionBatchDocumentSchema.parse(JSON.parse(body));
}
