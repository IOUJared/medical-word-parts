import {
  findAliasMatch,
  findExactTerm,
  toAuthoredAnalysis,
  toCanonicalTerm,
  type TermRecord,
} from "./catalog";
import { CorpusInvariantError, assertNever } from "./invariants";
import { normalizeTermInput } from "./normalization";
import { segmentTerm } from "./segmentation";
import type { AnalyzerResult, ExactProvenance, ExactResult, SourceId } from "./types";

type CitationSource =
  | (readonly SourceId[] & { readonly segments?: never })
  | { readonly segments: readonly { readonly citations: readonly SourceId[] }[] };

export function unionCitations(...groups: readonly CitationSource[]): readonly SourceId[] {
  return [...new Set(groups.flatMap((group): readonly SourceId[] => group.segments ? group.segments.flatMap((segment) => segment.citations) : group))];
}

function exactResult(input: string, term: TermRecord, provenance: ExactProvenance): ExactResult {
  const primary = term.analyses.find((analysis) => analysis.primary);
  if (primary === undefined) throw new CorpusInvariantError(term.id);
  const alternatives = [];
  for (const analysis of term.analyses) {
    if (!analysis.primary) alternatives.push(toAuthoredAnalysis(analysis));
  }
  let normalized: string;
  switch (provenance.kind) {
    case "canonical":
      normalized = term.normalized;
      break;
    case "alias":
      normalized = provenance.alias;
      break;
    default:
      return assertNever(provenance);
  }
  return {
    kind: "exact",
    input,
    normalized,
    term: toCanonicalTerm(term),
    provenance,
    confidence: { basis: "verified", score: 1 },
    primary: toAuthoredAnalysis(primary),
    alternatives,
  };
}

export function analyzeTerm(input: string): AnalyzerResult {
  const normalization = normalizeTermInput(input);
  switch (normalization.kind) {
    case "unsupported":
      return {
        kind: "unsupported",
        input,
        normalized: normalization.normalized,
        reason: normalization.reason,
      };
    case "supported": {
      const exact = findExactTerm(normalization.normalized);
      if (exact !== undefined) return exactResult(input, exact, { kind: "canonical" });

      const alias = findAliasMatch(normalization.normalized);
      if (alias !== undefined) return exactResult(input, alias.term, alias.provenance);

      const [primary, ...alternatives] = segmentTerm(normalization.normalized);
      if (primary === undefined) {
        return {
          kind: "unsupported",
          input,
          normalized: normalization.normalized,
          reason: "no_known_parts",
        };
      }
      switch (primary.confidence.basis) {
        case "complete_coverage":
          return {
            kind: "derived",
            input,
            normalized: normalization.normalized,
            confidence: primary.confidence,
            segments: primary.segments,
            unresolvedSpans: primary.unresolvedSpans,
            alternatives,
          };
        case "partial_coverage":
          return {
            kind: "partial",
            input,
            normalized: normalization.normalized,
            confidence: primary.confidence,
            segments: primary.segments,
            unresolvedSpans: primary.unresolvedSpans,
            alternatives,
          };
        default:
          return assertNever(primary.confidence);
      }
    }
    default:
      return assertNever(normalization);
  }
}

export type {
  AnalyzerResult,
  AuthoredAnalysis,
  CandidateAnalysis,
  Confidence,
  DerivedResult,
  ExactResult,
  PartialResult,
  Segment,
  UnsupportedResult,
  UnresolvedSpan,
} from "./types";
