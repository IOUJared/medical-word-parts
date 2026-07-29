import { corpus } from "../generated/corpus";
import { candidateTerms } from "../generated/candidates";
import { assertNever } from "./invariants";
import type { CandidateTermId, PartKind, PartId, SourceId, TermId } from "./types";

export type SearchKind = "term" | "candidateTerm" | PartKind;
export type SearchMatchKind = "exact" | "prefix" | "token_prefix" | "substring";
export type SearchMatchField = "term" | "alias" | "notation" | "surface" | "meaning";

export type SearchInput = {
  readonly query: string;
  readonly kinds?: readonly SearchKind[];
  readonly limit?: number;
};

export type SearchEvidence = {
  readonly kind: SearchMatchKind;
  readonly field: SearchMatchField;
  readonly value: string;
};

type SearchResultBase = {
  readonly matchedBy: SearchEvidence;
  readonly citations: readonly SourceId[];
};

export type TermSearchResult = SearchResultBase & {
  readonly kind: "term";
  readonly id: TermId;
  readonly term: string;
  readonly slug: string;
  readonly aliases: readonly string[];
};

export type PartSearchResult = SearchResultBase & {
  readonly kind: PartKind;
  readonly id: PartId;
  readonly notation: string;
  readonly surfaces: readonly string[];
  readonly meaning: string;
};

export type CandidateTermSearchResult = SearchResultBase & {
  readonly kind: "candidateTerm";
  readonly id: CandidateTermId;
  readonly term: string;
  readonly aliases: readonly string[];
  readonly status: "candidate";
  readonly sourceVersion: string;
  readonly license: string;
};

export type SearchResult = TermSearchResult | CandidateTermSearchResult | PartSearchResult;

type SearchField = {
  readonly field: SearchMatchField;
  readonly value: string;
};

const defaultResultLimit = 20;
const aliasesByTermId = new Map<string, string[]>();
for (const alias of corpus.aliases) {
  const aliases = aliasesByTermId.get(alias.termId);
  if (aliases === undefined) aliasesByTermId.set(alias.termId, [alias.alias]);
  else aliases.push(alias.alias);
}

function normalizedSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function matchField(query: string, candidate: SearchField): SearchEvidence | undefined {
  const value = normalizedSearchText(candidate.value);
  if (value === query) return { kind: "exact", field: candidate.field, value: candidate.value };
  if (value.startsWith(query)) return { kind: "prefix", field: candidate.field, value: candidate.value };
  if (value.split(/[\s/-]+/).some((token) => token.startsWith(query))) {
    return { kind: "token_prefix", field: candidate.field, value: candidate.value };
  }
  if (value.includes(query)) return { kind: "substring", field: candidate.field, value: candidate.value };
  return undefined;
}

function matchRank(kind: SearchMatchKind): number {
  switch (kind) {
    case "exact":
      return 0;
    case "prefix":
      return 1;
    case "token_prefix":
      return 2;
    case "substring":
      return 3;
    default:
      return assertNever(kind);
  }
}

function fieldRank(field: SearchMatchField): number {
  switch (field) {
    case "term":
      return 0;
    case "alias":
      return 1;
    case "notation":
      return 2;
    case "surface":
      return 3;
    case "meaning":
      return 4;
    default:
      return assertNever(field);
  }
}

function bestEvidence(query: string, fields: readonly SearchField[]): SearchEvidence | undefined {
  return fields
    .flatMap((field) => {
      const evidence = matchField(query, field);
      return evidence === undefined ? [] : [evidence];
    })
    .sort((left, right) => {
      const quality = matchRank(left.kind) - matchRank(right.kind);
      return quality !== 0 ? quality : fieldRank(left.field) - fieldRank(right.field);
    })[0];
}

function partSurfaces(notation: string, kind: PartKind): readonly string[] {
  const canonical = notation.replaceAll("-", "").replaceAll("/", "");
  return kind === "combiningForm" && canonical.endsWith("o")
    ? [canonical, canonical.slice(0, -1)]
    : [canonical];
}

function termResults(query: string): readonly TermSearchResult[] {
  return corpus.terms.flatMap((term) => {
    const aliases = aliasesByTermId.get(term.id) ?? [];
    const evidence = bestEvidence(query, [
      { field: "term", value: term.term },
      ...aliases.map((alias) => ({ field: "alias" as const, value: alias })),
    ]);
    return evidence === undefined
      ? []
      : [
          {
            kind: "term" as const,
            id: term.id,
            term: term.term,
            slug: term.slug,
            aliases,
            matchedBy: evidence,
            citations: [...term.sources],
          },
        ];
  });
}

function partResults(query: string): readonly PartSearchResult[] {
  return corpus.parts.flatMap((part) => {
    const surfaces = partSurfaces(part.form, part.kind);
    const evidence = bestEvidence(query, [
      { field: "notation", value: part.form },
      ...surfaces.map((surface) => ({ field: "surface" as const, value: surface })),
      { field: "meaning", value: part.meaning },
    ]);
    return evidence === undefined
      ? []
      : [
          {
            kind: part.kind,
            id: part.id,
            notation: part.form,
            surfaces,
            meaning: part.meaning,
            matchedBy: evidence,
            citations: [...part.sources],
          },
        ];
  });
}

function candidateTermResults(query: string): readonly CandidateTermSearchResult[] {
  return candidateTerms.flatMap((candidateTerm) => {
    const aliases = "aliases" in candidateTerm ? candidateTerm.aliases : [];
    const evidence = bestEvidence(query, [
      { field: "term", value: candidateTerm.term },
      ...aliases.map((alias) => ({ field: "alias" as const, value: alias })),
    ]);
    return evidence === undefined
      ? []
      : [
          {
            kind: "candidateTerm" as const,
            id: candidateTerm.id,
            term: candidateTerm.term,
            aliases,
            status: candidateTerm.status,
            sourceVersion: candidateTerm.sourceVersion,
            license: candidateTerm.license,
            matchedBy: evidence,
            citations: [...candidateTerm.sources],
          },
        ];
  });
}

function sourceRank(result: SearchResult): number {
  switch (result.kind) {
    case "term":
      return 0;
    case "prefix":
    case "root":
    case "suffix":
    case "combiningForm":
      return 1;
    case "candidateTerm":
      return 2;
    default:
      return assertNever(result);
  }
}

function compareResults(left: SearchResult, right: SearchResult): number {
  const quality = matchRank(left.matchedBy.kind) - matchRank(right.matchedBy.kind);
  if (quality !== 0) return quality;
  const source = sourceRank(left) - sourceRank(right);
  if (source !== 0) return source;
  const field = fieldRank(left.matchedBy.field) - fieldRank(right.matchedBy.field);
  if (field !== 0) return field;
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

export function searchCorpus(input: SearchInput): readonly SearchResult[] {
  const query = normalizedSearchText(input.query);
  const limit = Math.max(0, Math.floor(input.limit ?? defaultResultLimit));
  if (query.length === 0 || limit === 0) return [];
  const kindSet = input.kinds === undefined ? undefined : new Set(input.kinds);
  return [...termResults(query), ...partResults(query), ...candidateTermResults(query)]
    .filter((result) => kindSet === undefined || kindSet.has(result.kind))
    .sort(compareResults)
    .slice(0, limit);
}
