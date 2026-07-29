import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";

import { DataError } from "./errors";
import { compareCodePoints } from "./ordering";
import {
  aliasesDocumentSchema,
  candidateReviewDecisionsDocumentSchema,
  candidateTermsDocumentSchema,
  partsDocumentSchema,
  relationsDocumentSchema,
  sourcesDocumentSchema,
  termSchema,
  type Alias,
  type CandidateTerm,
  type CandidateReviewDecision,
  type Part,
  type Relation,
  type Source,
  type Term,
} from "./schemas";

export type Located<Value> = {
  readonly path: string;
  readonly value: Value;
};

export type LoadedCorpus = {
  readonly sources: readonly Located<Source>[];
  readonly parts: readonly Located<Part>[];
  readonly terms: readonly Located<Term>[];
  readonly aliases: readonly Located<Alias>[];
  readonly candidateTerms: readonly Located<CandidateTerm>[];
  readonly candidateReviewDecisions: readonly Located<CandidateReviewDecision>[];
  readonly relations: readonly Located<Relation>[];
};

function displayPath(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

function parseFile<Value>(root: string, path: string, schema: z.ZodType<Value>): Value {
  const location = displayPath(root, path);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new DataError(location, `invalid JSON: ${error.message}`);
    }
    throw error;
  }
  const result = schema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues
    .map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
    .join("; ");
  throw new DataError(location, details);
}

function loadParts(root: string, filename: string, expectedKind: Part["kind"]): readonly Located<Part>[] {
  const path = join(root, "word-parts", filename);
  const document = parseFile(root, path, partsDocumentSchema);
  for (const part of document.parts) {
    if (part.kind !== expectedKind) {
      throw new DataError(displayPath(root, path), `expected ${expectedKind} parts, received ${part.kind}`);
    }
  }
  return document.parts.map((value) => ({ path: displayPath(root, path), value }));
}

function loadTerms(root: string): readonly Located<Term>[] {
  const directory = join(root, "terms");
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort(compareCodePoints)
    .map((name) => {
      const path = join(directory, name);
      return { path: displayPath(root, path), value: parseFile(root, path, termSchema) };
    });
}

export function loadCorpus(root: string): LoadedCorpus {
  const sourcePath = join(root, "sources.json");
  const aliasPath = join(root, "aliases.json");
  const relationPath = join(root, "relations.json");
  const candidateTermsPath = join(root, "candidate-terms.json");
  const candidateReviewDecisionsPath = join(root, "candidate-review-decisions.json");
  const sources = parseFile(root, sourcePath, sourcesDocumentSchema).sources.map((value) => ({
    path: displayPath(root, sourcePath),
    value,
  }));
  const aliases = parseFile(root, aliasPath, aliasesDocumentSchema).aliases.map((value) => ({
    path: displayPath(root, aliasPath),
    value,
  }));
  const relations = parseFile(root, relationPath, relationsDocumentSchema).relations.map((value) => ({
    path: displayPath(root, relationPath),
    value,
  }));
  const candidateTerms = parseFile(root, candidateTermsPath, candidateTermsDocumentSchema).candidateTerms.map((value) => ({
    path: displayPath(root, candidateTermsPath),
    value,
  }));
  const candidateReviewDecisions = parseFile(
    root,
    candidateReviewDecisionsPath,
    candidateReviewDecisionsDocumentSchema,
  ).candidateReviewDecisions.map((value) => ({
    path: displayPath(root, candidateReviewDecisionsPath),
    value,
  }));
  return {
    sources,
    parts: [
      ...loadParts(root, "prefixes.json", "prefix"),
      ...loadParts(root, "roots.json", "root"),
      ...loadParts(root, "suffixes.json", "suffix"),
      ...loadParts(root, "combining-forms.json", "combiningForm"),
    ],
    terms: loadTerms(root),
    aliases,
    candidateTerms,
    candidateReviewDecisions,
    relations,
  };
}
