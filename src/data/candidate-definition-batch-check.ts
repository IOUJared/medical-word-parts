import { z } from "zod";

const candidateDefinitionBatchSummarySchema = z.object({
  candidateTermCount: z.number().int().nonnegative(),
  deferredCandidateCount: z.number().int().nonnegative(),
  includedCandidateCount: z.number().int().nonnegative(),
  meshDefinitionCount: z.number().int().nonnegative(),
  sourceReviewLeadCount: z.number().int().nonnegative(),
  failedDefinitionCount: z.number().int().nonnegative(),
  batchSize: z.number().int().nonnegative(),
  batchNumber: z.number().int().positive(),
  batchStart: z.number().int().nonnegative(),
  batchEnd: z.number().int().nonnegative(),
  remainingCandidateCount: z.number().int().nonnegative(),
});

const candidateDefinitionBatchDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  summary: candidateDefinitionBatchSummarySchema,
  candidates: z.array(z.object({ candidateId: z.string().min(1), status: z.string().min(1) })),
});

export type SavedCandidateDefinitionBatch = z.infer<typeof candidateDefinitionBatchDocumentSchema>;

export function parseCandidateDefinitionBatchJson(body: string): SavedCandidateDefinitionBatch {
  return candidateDefinitionBatchDocumentSchema.parse(JSON.parse(body));
}
