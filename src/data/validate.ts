import { DataValidationError } from "./errors";
import type { LoadedCorpus, Located } from "./load";
import { compareCodePoints } from "./ordering";
import type { Alias, Part, Relation, Source, Term } from "./schemas";
import { checkAnalyses } from "./validate-analyses";

export type Corpus = {
  readonly sources: readonly Source[];
  readonly parts: readonly Part[];
  readonly terms: readonly Term[];
  readonly aliases: readonly Alias[];
  readonly relations: readonly Relation[];
};

type CorpusReferences = {
  readonly sourceIds: ReadonlySet<string>;
  readonly termIds: ReadonlySet<string>;
  readonly normalizedTerms: ReadonlySet<string>;
};

function addDuplicateErrors<Value extends { readonly id: string }>(
  records: readonly Located<Value>[],
  label: string,
  errors: string[],
): void {
  const seen = new Map<string, string>();
  for (const record of records) {
    const recordId = record.value.id;
    const previous = seen.get(recordId);
    if (previous === undefined) {
      seen.set(recordId, record.path);
    } else {
      errors.push(`${record.path}: duplicate ${label} ${recordId}; first in ${previous}`);
    }
  }
}

function checkSources<Value extends { readonly sources: readonly string[]; readonly id?: string }>(
  records: readonly Located<Value>[],
  sourceIds: ReadonlySet<string>,
  errors: string[],
): void {
  for (const record of records) {
    for (const sourceId of record.value.sources) {
      if (!sourceIds.has(sourceId)) {
        const recordId = record.value.id === undefined ? "" : `${record.value.id}: `;
        errors.push(`${record.path}: ${recordId}dangling source ${sourceId}`);
      }
    }
  }
}

function checkTermKeys(terms: readonly Located<Term>[], errors: string[]): void {
  const slugs = new Set<string>();
  const normalized = new Set<string>();
  for (const term of terms) {
    const termSlug = term.value.slug;
    const termNormalized = term.value.normalized;
    if (termNormalized !== term.value.term) {
      errors.push(`${term.path}: term ${term.value.id} normalized ${termNormalized} must equal ${term.value.term}`);
    }
    if (slugs.has(termSlug)) {
      errors.push(`${term.path}: duplicate term slug ${termSlug}`);
    }
    if (normalized.has(termNormalized)) {
      errors.push(`${term.path}: duplicate term normalized ${termNormalized}`);
    }
    slugs.add(termSlug);
    normalized.add(termNormalized);
  }
}

function checkAliases(
  aliases: readonly Located<Alias>[],
  references: CorpusReferences,
  errors: string[],
): void {
  const aliasesByNormalized = new Set<string>();
  for (const alias of aliases) {
    const { alias: aliasValue, normalized: aliasNormalized, termId } = alias.value;
    if (aliasNormalized !== aliasValue) {
      errors.push(`${alias.path}: alias ${aliasValue} normalized ${aliasNormalized} must equal ${aliasValue}`);
    }
    if (!references.termIds.has(termId)) {
      errors.push(`${alias.path}: dangling term ${termId}`);
    }
    if (references.normalizedTerms.has(aliasNormalized) || aliasesByNormalized.has(aliasNormalized)) {
      errors.push(`${alias.path}: duplicate alias normalized ${aliasNormalized}`);
    }
    aliasesByNormalized.add(aliasNormalized);
  }
  checkSources(aliases, references.sourceIds, errors);
}

function checkRelations(
  relations: readonly Located<Relation>[],
  references: CorpusReferences,
  errors: string[],
): void {
  const keys = new Set<string>();
  for (const relation of relations) {
    const { from, to, kind } = relation.value;
    if (from === to) {
      errors.push(`${relation.path}: self relation ${kind} ${from}`);
    }
    if (!references.termIds.has(from)) {
      errors.push(`${relation.path}: dangling relation term ${from}`);
    }
    if (!references.termIds.has(to)) {
      errors.push(`${relation.path}: dangling relation term ${to}`);
    }
    const ordered = [from, to].sort(compareCodePoints).join("|");
    const key = `${kind}|${ordered}`;
    if (keys.has(key)) {
      errors.push(`${relation.path}: duplicate relation ${key}`);
    }
    keys.add(key);
  }
  checkSources(relations, references.sourceIds, errors);
}

export function validateCorpus(loaded: LoadedCorpus): Corpus {
  const errors: string[] = [];
  addDuplicateErrors(loaded.sources, "source id", errors);
  addDuplicateErrors(loaded.parts, "part id", errors);
  addDuplicateErrors(loaded.terms, "term id", errors);
  checkTermKeys(loaded.terms, errors);
  const references: CorpusReferences = {
    sourceIds: new Set(loaded.sources.map((record) => record.value.id)),
    termIds: new Set(loaded.terms.map((record) => record.value.id)),
    normalizedTerms: new Set(loaded.terms.map((record) => record.value.normalized)),
  };
  const partById = new Map(loaded.parts.map((record) => [record.value.id, record.value]));
  checkSources(loaded.parts, references.sourceIds, errors);
  checkSources(loaded.terms, references.sourceIds, errors);
  checkAnalyses(loaded.terms, partById, errors);
  checkAliases(loaded.aliases, references, errors);
  checkRelations(loaded.relations, references, errors);
  if (errors.length > 0) {
    throw new DataValidationError(errors);
  }
  return {
    sources: loaded.sources.map((record) => record.value),
    parts: loaded.parts.map((record) => record.value),
    terms: loaded.terms.map((record) => record.value),
    aliases: loaded.aliases.map((record) => record.value),
    relations: loaded.relations.map((record) => record.value),
  };
}
