import { DataError } from "./errors";
import { createCandidateTriageReport, type CandidateTriageItem, type CandidateTriageSegment } from "./candidate-triage";
import type { Corpus } from "./validate";

export type CandidatePromotionDraftUnresolvedSpan = {
  readonly surface: string;
  readonly start: number;
  readonly end: number;
  readonly todo: string;
};

export type CandidatePromotionDraft = {
  readonly id: string;
  readonly slug: string;
  readonly term: string;
  readonly normalized: string;
  readonly sources: readonly string[];
  readonly note: string;
  readonly analyses: readonly [{
    readonly id: string;
    readonly primary: true;
    readonly segments: readonly CandidateTriageSegment[];
  }];
  readonly draftReview: {
    readonly candidateId: string;
    readonly status: "needs_source_verified_completion";
    readonly unresolvedSpans: readonly CandidatePromotionDraftUnresolvedSpan[];
  };
};

function termSlugFromCandidate(candidate: CandidateTriageItem): string {
  return candidate.normalized.replaceAll(" ", "-");
}

function draftFromCandidate(candidate: CandidateTriageItem): CandidatePromotionDraft {
  const slug = termSlugFromCandidate(candidate);
  return {
    id: `term:${slug}`,
    slug,
    term: candidate.normalized,
    normalized: candidate.normalized,
    sources: candidate.sources,
    note: "TODO: replace with a source-cited word-part teaching note before moving this draft into data/terms.",
    analyses: [{ id: `analysis:${slug}-primary`, primary: true, segments: candidate.knownSegments }],
    draftReview: {
      candidateId: candidate.id,
      status: "needs_source_verified_completion",
      unresolvedSpans: candidate.unresolvedSpans.map((span) => ({
        surface: span.surface,
        start: span.start,
        end: span.end,
        todo: "Source and add this word part before promotion.",
      })),
    },
  };
}

export function createCandidatePromotionDraft(corpus: Corpus, candidateId: string): CandidatePromotionDraft {
  const report = createCandidateTriageReport(corpus);
  const candidates = report.categories.flatMap((category) => category.candidates);
  const candidate = candidates.find((item) => item.id === candidateId);
  if (candidate === undefined) throw new DataError(candidateId, "unknown candidate");
  if (candidate.category === "verified_collision") throw new DataError(candidateId, "candidate collides with a verified term");
  return draftFromCandidate(candidate);
}

export function candidatePromotionDraftJson(draft: CandidatePromotionDraft): string {
  return `${JSON.stringify(draft, null, 2)}\n`;
}
