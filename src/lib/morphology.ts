import type { Segment, UnresolvedSpan } from "../core";

export type RailAnalysis = {
  readonly segments: readonly Segment[];
  readonly unresolvedSpans?: readonly UnresolvedSpan[];
};

export type RailItem =
  | { readonly kind: "segment"; readonly start: number; readonly segment: Segment }
  | { readonly kind: "unresolved"; readonly start: number; readonly span: UnresolvedSpan };

export function orderedRailItems(analysis: RailAnalysis): readonly RailItem[] {
  return [
    ...analysis.segments.map((segment) => ({ kind: "segment", start: segment.start, segment }) as const),
    ...(analysis.unresolvedSpans ?? []).map((span) => ({ kind: "unresolved", start: span.start, span }) as const),
  ].sort((left, right) => left.start - right.start);
}
