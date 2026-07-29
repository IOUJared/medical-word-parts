import { corpus } from "../generated/corpus";
import { partToTermUsage } from "../generated/index";
import { findTermById, type TermRecord } from "./catalog";
import type { RelationKind, SourceId, TermId } from "./types";

export type TermSummary = {
  readonly id: TermId;
  readonly slug: string;
  readonly term: string;
};

export type RelatedTerm = {
  readonly kind: RelationKind;
  readonly term: TermSummary;
  readonly citations: readonly SourceId[];
};

function toTermSummary(term: TermRecord): TermSummary {
  return { id: term.id, slug: term.slug, term: term.term };
}

function compareTermSummaries(left: TermSummary, right: TermSummary): number {
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

export function getRelatedTerms(termId: string): readonly RelatedTerm[] {
  const relatedTerms: RelatedTerm[] = [];
  for (const relation of corpus.relations) {
    if (relation.from !== termId && relation.to !== termId) continue;
    const relatedId = relation.from === termId ? relation.to : relation.from;
    relatedTerms.push({
      kind: relation.kind,
      term: toTermSummary(findTermById(relatedId)),
      citations: [...relation.sources],
    });
  }
  return relatedTerms.sort((left, right) => {
      const termOrder = compareTermSummaries(left.term, right.term);
      if (termOrder !== 0) return termOrder;
      if (left.kind < right.kind) return -1;
      if (left.kind > right.kind) return 1;
      return 0;
  });
}

export function getPartUsage(partId: string): readonly TermSummary[] {
  const usage = Object.entries(partToTermUsage).find(([candidateId]) => candidateId === partId);
  if (usage === undefined) return [];
  return usage[1].map((termId) => toTermSummary(findTermById(termId))).sort(compareTermSummaries);
}
