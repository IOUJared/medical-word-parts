import type { Located } from "./load";
import type { Part, Term, Transformation } from "./schemas";

const vowelStart = /^[aeiou]/;
const invalidDropContext = "drop_terminal_vowel must be immediately followed by a contiguous vowel-start suffix";

type AnalysisOwner = {
  readonly path: string;
  readonly termId: string;
};

function realizedForm(part: Part, transformations: readonly Transformation[]): string | undefined {
  const base = part.form.replaceAll("-", "").replaceAll("/", "");
  if (transformations.length === 0) return base;
  const transformation = transformations[0];
  if (transformation === undefined || part.kind !== "combiningForm" || !base.endsWith(transformation.vowel)) {
    return undefined;
  }
  return base.slice(0, -transformation.vowel.length);
}

function checkAnalysisIds(terms: readonly Located<Term>[], errors: string[]): void {
  const seen = new Map<string, AnalysisOwner>();
  for (const record of terms) {
    for (const analysis of record.value.analyses) {
      const previous = seen.get(analysis.id);
      if (previous === undefined) {
        seen.set(analysis.id, { path: record.path, termId: record.value.id });
      } else {
        errors.push(
          `${record.path}: ${record.value.id}: duplicate analysis id ${analysis.id}; first in ${previous.path}: ${previous.termId}`,
        );
      }
    }
  }
}

function hasValidDropContext(
  analysis: Term["analyses"][number],
  segmentIndex: number,
  partById: ReadonlyMap<string, Part>,
): boolean {
  const segment = analysis.segments[segmentIndex];
  const next = analysis.segments[segmentIndex + 1];
  if (segment === undefined || next === undefined || next.start !== segment.end) return false;
  return partById.get(next.partId)?.kind === "suffix" && vowelStart.test(next.surface);
}

export function checkAnalyses(
  terms: readonly Located<Term>[],
  partById: ReadonlyMap<string, Part>,
  errors: string[],
): void {
  checkAnalysisIds(terms, errors);
  for (const record of terms) {
    const recordId = record.value.id;
    const recordNormalized = record.value.normalized;
    const primaryCount = record.value.analyses.filter((analysis) => analysis.primary).length;
    if (primaryCount !== 1) {
      errors.push(`${record.path}: term ${recordId} requires exactly one primary analysis`);
    }
    for (const analysis of record.value.analyses) {
      let cursor = 0;
      for (const [segmentIndex, segment] of analysis.segments.entries()) {
        const location = `${record.path}: ${recordId} ${analysis.id}`;
        if (segment.start !== cursor) errors.push(`${location}: segments must be contiguous`);
        if (segment.end > recordNormalized.length || segment.end <= segment.start) {
          errors.push(`${location}: segment span is outside the normalized term`);
        }
        if (recordNormalized.slice(segment.start, segment.end) !== segment.surface) {
          errors.push(`${location}: segment surface does not reconstruct ${recordNormalized}`);
        }
        const transformations = segment.transformations ?? [];
        const part = partById.get(segment.partId);
        if (part === undefined) {
          errors.push(`${location}: dangling part ${segment.partId}`);
        } else {
          const transformed = realizedForm(part, transformations);
          if (transformed === undefined) errors.push(`${location}: drop_terminal_vowel does not apply to ${segment.partId}`);
          else if (transformed !== segment.surface) errors.push(`${location}: segment surface does not match ${segment.partId}`);
        }
        if (transformations.length > 0 && !hasValidDropContext(analysis, segmentIndex, partById)) {
          errors.push(`${location}: ${invalidDropContext}`);
        }
        cursor = segment.end;
      }
      if (cursor !== recordNormalized.length) {
        errors.push(`${record.path}: ${recordId} analysis does not reconstruct the complete term`);
      }
    }
  }
}
