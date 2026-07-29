import { z } from "zod";

export const partKinds = ["prefix", "root", "suffix", "combiningForm"] as const;
export const relationKinds = ["contrast", "related"] as const;
export const candidateReviewReasons = [
  "insufficient_decomposition_evidence",
  "term_schema_incompatible",
] as const;

const partNamespaceByKind = {
  prefix: "prefix",
  root: "root",
  suffix: "suffix",
  combiningForm: "combining",
} as const satisfies Record<(typeof partKinds)[number], string>;

const sourceId = z.string().regex(/^source:[a-z0-9-]+$/, "source ID must use source: namespace");
const termId = z.string().regex(/^term:[a-z0-9-]+$/, "term ID must use term: namespace");
const candidateId = z.string().regex(/^candidate:[a-z0-9-]+$/, "candidate ID must use candidate: namespace");
const analysisId = z.string().regex(/^analysis:[a-z0-9-]+$/, "analysis ID must use analysis: namespace");
const partId = z
  .string()
  .regex(/^(?:prefix|root|suffix|combining):[a-z0-9-]+$/, "part ID must use a part-kind namespace");
const normalizedWord = z.string().regex(/^[a-z]+$/);
const normalizedCandidateTerm = z.string().regex(/^[a-z0-9]+(?:[ -][a-z0-9]+)*$/);
const citationIds = z
  .array(sourceId)
  .min(1)
  .superRefine((citations, context) => {
    const seen = new Set<string>();
    for (const [index, sourceId] of citations.entries()) {
      if (seen.has(sourceId)) {
        context.addIssue({ code: "custom", path: [index], message: `duplicate source ID ${sourceId}` });
      }
      seen.add(sourceId);
    }
  });

export const sourceSchema = z.strictObject({
    id: sourceId,
    publisher: z.string().min(1),
    title: z.string().min(1),
    url: z.url().refine((value) => new URL(value).protocol === "https:", "source URL must use HTTPS"),
  });

export const sourcesDocumentSchema = z.strictObject({ sources: z.array(sourceSchema).min(1) });

export const partSchema = z.strictObject({
    id: partId,
    kind: z.enum(partKinds),
    form: z.string().regex(/^[a-z/-]+$/),
    meaning: z.string().min(1),
    sources: citationIds,
  }).superRefine((part, context) => {
    const namespace = partNamespaceByKind[part.kind];
    if (!part.id.startsWith(`${namespace}:`)) {
      context.addIssue({
        code: "custom",
        path: ["id"],
        message: `part ID must use ${namespace}: namespace for kind ${part.kind}`,
      });
    }
  });

export const partsDocumentSchema = z.strictObject({ parts: z.array(partSchema).min(1) });

const transformationSchema = z.strictObject({ kind: z.literal("drop_terminal_vowel"), vowel: z.literal("o") });

export const segmentSchema = z.strictObject({
    partId,
    surface: normalizedWord,
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    transformations: z.array(transformationSchema).max(1).optional(),
  });

export const analysisSchema = z.strictObject({
    id: analysisId,
    primary: z.boolean(),
    qualification: z.string().min(1).optional(),
    segments: z.array(segmentSchema).min(1),
  });

export const termSchema = z.strictObject({
    id: termId,
    slug: normalizedWord,
    term: normalizedWord,
    normalized: normalizedWord,
    sources: citationIds,
    note: z.string().min(1),
    analyses: z.array(analysisSchema).min(1),
  });

export const aliasSchema = z.strictObject({
    alias: normalizedWord,
    normalized: normalizedWord,
    termId,
    sources: citationIds,
  });

export const aliasesDocumentSchema = z.strictObject({ aliases: z.array(aliasSchema) });

export const candidateTermSchema = z.strictObject({
    id: candidateId,
    term: z.string().min(1),
    normalized: normalizedCandidateTerm,
    status: z.literal("candidate"),
    sources: citationIds,
    sourceVersion: z.string().min(1),
    license: z.string().min(1),
    aliases: z.array(z.string().min(1)).optional(),
    externalIds: z.record(z.string().min(1), z.string().min(1)).optional(),
  });

export const candidateTermsDocumentSchema = z.strictObject({ candidateTerms: z.array(candidateTermSchema) });

export const candidateReviewDecisionSchema = z.strictObject({
    candidateId,
    outcome: z.literal("deferred"),
    reason: z.enum(candidateReviewReasons),
    reviewSources: citationIds,
    note: z.string().min(1),
  });

export const candidateReviewDecisionsDocumentSchema = z.strictObject({
  candidateReviewDecisions: z.array(candidateReviewDecisionSchema),
});

export const relationSchema = z.strictObject({
    kind: z.enum(relationKinds),
    from: termId,
    to: termId,
    sources: citationIds,
  });

export const relationsDocumentSchema = z.strictObject({ relations: z.array(relationSchema) });

export type Source = z.infer<typeof sourceSchema>;
export type Part = z.infer<typeof partSchema>;
export type Term = z.infer<typeof termSchema>;
export type Alias = z.infer<typeof aliasSchema>;
export type CandidateTerm = z.infer<typeof candidateTermSchema>;
export type CandidateReviewDecision = z.infer<typeof candidateReviewDecisionSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type Transformation = z.infer<typeof transformationSchema>;
