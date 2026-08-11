import { corpus } from "../generated/corpus";
import { CorpusInvariantError } from "./invariants";
import type {
  AuthoredAnalysis,
  CanonicalTerm,
  ExactProvenance,
  PartId,
  PartKind,
  Segment,
  SourceId,
  TermId,
  Transformation,
} from "./types";

type PartRecord = {
  readonly id: PartId;
  readonly kind: PartKind;
  readonly form: string;
  readonly meaning: string;
  readonly sources: readonly SourceId[];
};

type SegmentRecord = {
  readonly partId: PartId;
  readonly surface: string;
  readonly start: number;
  readonly end: number;
  readonly transformations?: readonly Transformation[];
};

type AnalysisRecord = {
  readonly id: string;
  readonly primary: boolean;
  readonly qualification?: string;
  readonly segments: readonly SegmentRecord[];
};

export type TermRecord = {
  readonly id: TermId;
  readonly slug: string;
  readonly term: string;
  readonly normalized: string;
  readonly sources: readonly SourceId[];
  readonly note: string;
  readonly analyses: readonly AnalysisRecord[];
};

const partById: ReadonlyMap<string, PartRecord> = new Map(corpus.parts.map((part) => [part.id, part]));
const termById: ReadonlyMap<string, TermRecord> = new Map(corpus.terms.map((term) => [term.id, term]));
const termIdByNormalized: ReadonlyMap<string, string> = new Map(
  corpus.terms.map((term) => [term.normalized, term.id]),
);
const aliasByNormalized: ReadonlyMap<string, (typeof corpus.aliases)[number]> = new Map(
  corpus.aliases.map((alias) => [alias.normalized, alias]),
);

export function findPartById(partId: string): PartRecord {
  const part = partById.get(partId);
  if (part === undefined) throw new CorpusInvariantError(partId);
  return part;
}

export function findTermById(termId: string): TermRecord {
  const term = termById.get(termId);
  if (term === undefined) throw new CorpusInvariantError(termId);
  return term;
}

export function findExactTerm(normalized: string): TermRecord | undefined {
  const termId = termIdByNormalized.get(normalized);
  return termId === undefined ? undefined : findTermById(termId);
}

export function findAliasMatch(
  normalized: string,
): { readonly term: TermRecord; readonly provenance: ExactProvenance } | undefined {
  const alias = aliasByNormalized.get(normalized);
  if (alias === undefined) return undefined;
  return {
    term: findTermById(alias.termId),
    provenance: { kind: "alias", alias: alias.alias, citations: [...alias.sources] },
  };
}

export function toSegment(record: SegmentRecord): Segment {
  const part = findPartById(record.partId);
  return {
    start: record.start,
    end: record.end,
    surface: record.surface,
    partId: part.id,
    notation: part.form,
    kind: part.kind,
    meaning: part.meaning,
    transformations: record.transformations === undefined ? [] : [...record.transformations],
    citations: [...part.sources],
  };
}

export function toAuthoredAnalysis(record: AnalysisRecord): AuthoredAnalysis {
  const segments = record.segments.map(toSegment);
  return record.qualification === undefined
    ? { id: record.id, segments }
    : { id: record.id, qualification: record.qualification, segments };
}

export function toCanonicalTerm(record: TermRecord): CanonicalTerm {
  return {
    id: record.id,
    slug: record.slug,
    term: record.term,
    normalized: record.normalized,
    note: record.note,
    citations: [...record.sources],
  };
}
