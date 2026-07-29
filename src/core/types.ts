import type { corpus } from "../generated/corpus";

export type PartId = (typeof corpus.parts)[number]["id"];
export type TermId = (typeof corpus.terms)[number]["id"];
export type SourceId = (typeof corpus.sources)[number]["id"];
export type PartKind = (typeof corpus.parts)[number]["kind"];
export type RelationKind = (typeof corpus.relations)[number]["kind"];

export type Transformation = {
  readonly kind: "drop_terminal_vowel";
  readonly vowel: "o";
};

export type Segment = {
  readonly start: number;
  readonly end: number;
  readonly surface: string;
  readonly partId: PartId;
  readonly notation: string;
  readonly kind: PartKind;
  readonly meaning: string;
  readonly transformations: readonly Transformation[];
  readonly citations: readonly SourceId[];
};

export type UnresolvedSpan = {
  readonly start: number;
  readonly end: number;
  readonly surface: string;
};

export type Confidence =
  | { readonly basis: "verified"; readonly score: 1 }
  | { readonly basis: "complete_coverage"; readonly score: number }
  | { readonly basis: "partial_coverage"; readonly score: number };

export type AuthoredAnalysis = {
  readonly id: string;
  readonly qualification?: string;
  readonly segments: readonly Segment[];
};

export type CandidateAnalysis = {
  readonly confidence: Extract<Confidence, { readonly basis: "complete_coverage" | "partial_coverage" }>;
  readonly segments: readonly Segment[];
  readonly unresolvedSpans: readonly UnresolvedSpan[];
};

export type CanonicalTerm = {
  readonly id: TermId;
  readonly slug: string;
  readonly term: string;
  readonly normalized: string;
  readonly note: string;
  readonly citations: readonly SourceId[];
};

export type ExactProvenance =
  | { readonly kind: "canonical" }
  | {
      readonly kind: "alias";
      readonly alias: string;
      readonly citations: readonly SourceId[];
    };

type ResultBase = {
  readonly input: string;
  readonly normalized: string;
};

export type ExactResult = ResultBase & {
  readonly kind: "exact";
  readonly term: CanonicalTerm;
  readonly provenance: ExactProvenance;
  readonly confidence: Extract<Confidence, { readonly basis: "verified" }>;
  readonly primary: AuthoredAnalysis;
  readonly alternatives: readonly AuthoredAnalysis[];
};

export type DerivedResult = ResultBase &
  CandidateAnalysis & {
    readonly kind: "derived";
    readonly confidence: Extract<Confidence, { readonly basis: "complete_coverage" }>;
    readonly alternatives: readonly CandidateAnalysis[];
  };

export type PartialResult = ResultBase &
  CandidateAnalysis & {
    readonly kind: "partial";
    readonly confidence: Extract<Confidence, { readonly basis: "partial_coverage" }>;
    readonly alternatives: readonly CandidateAnalysis[];
  };

export const unsupportedReasons = [
  "empty",
  "too_long",
  "multiple_words",
  "unsupported_characters",
  "no_known_parts",
] as const;

export type UnsupportedReason = (typeof unsupportedReasons)[number];

export type UnsupportedResult = ResultBase & {
  readonly kind: "unsupported";
  readonly reason: UnsupportedReason;
};

export type AnalyzerResult = ExactResult | DerivedResult | PartialResult | UnsupportedResult;
