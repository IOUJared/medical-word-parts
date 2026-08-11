import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { compareCodePoints } from "./ordering";
import type { Corpus } from "./validate";

const generatedHeader = "// GENERATED FILE. DO NOT EDIT. Run npm run data:build to regenerate.";
const generatedCandidateType = `import type { corpus } from "./corpus";

type CandidateTerm = {
  readonly id: \`candidate:\${string}\`;
  readonly term: string;
  readonly normalized: string;
  readonly status: "candidate";
  readonly sources: readonly (typeof corpus.sources)[number]["id"][];
  readonly sourceVersion: string;
  readonly license: string;
  readonly aliases?: readonly string[];
  readonly externalIds?: Readonly<Record<string, string>>;
};`;

type CitationBucket = {
  readonly terms: readonly string[];
  readonly candidateTerms: readonly string[];
  readonly parts: readonly string[];
  readonly aliases: readonly string[];
  readonly relations: readonly string[];
};

type CitationAccumulator = {
  readonly terms: string[];
  readonly candidateTerms: string[];
  readonly parts: string[];
  readonly aliases: string[];
  readonly relations: string[];
};

export type GeneratedOutput = {
  readonly filename: string;
  readonly contents: string;
};

function sortedById<Value extends { readonly id: string }>(values: readonly Value[]): readonly Value[] {
  return [...values].sort((left, right) => compareCodePoints(left.id, right.id));
}

function sortedStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareCodePoints);
}

function json(value: object): string {
  return JSON.stringify(value, null, 2);
}

function reversePartUsage(corpus: Corpus): Record<string, readonly string[]> {
  const usage = new Map<string, string[]>();
  for (const part of corpus.parts) {
    usage.set(part.id, []);
  }
  for (const term of corpus.terms) {
    for (const analysis of term.analyses) {
      for (const segment of analysis.segments) {
        const terms = usage.get(segment.partId);
        if (terms !== undefined) {
          terms.push(term.id);
        }
      }
    }
  }
  return Object.fromEntries(
    [...usage.entries()]
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([partId, termIds]) => [partId, sortedStrings(termIds)]),
  );
}

function relatedTerms(corpus: Corpus): Record<string, readonly string[]> {
  const related = new Map<string, string[]>();
  for (const term of corpus.terms) {
    related.set(term.id, []);
  }
  for (const relation of corpus.relations) {
    const from = related.get(relation.from);
    const to = related.get(relation.to);
    if (from !== undefined && to !== undefined) {
      from.push(relation.to);
      to.push(relation.from);
    }
  }
  return Object.fromEntries(
    [...related.entries()]
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([termId, relatedIds]) => [termId, sortedStrings(relatedIds)]),
  );
}

function citations(corpus: Corpus): Record<string, CitationBucket> {
  const buckets = new Map<string, CitationAccumulator>();
  for (const source of corpus.sources) {
    buckets.set(source.id, { terms: [], candidateTerms: [], parts: [], aliases: [], relations: [] });
  }
  for (const term of corpus.terms) {
    for (const sourceId of term.sources) {
      const bucket = buckets.get(sourceId);
      if (bucket !== undefined) bucket.terms.push(term.id);
    }
  }
  for (const part of corpus.parts) {
    for (const sourceId of part.sources) {
      const bucket = buckets.get(sourceId);
      if (bucket !== undefined) bucket.parts.push(part.id);
    }
  }
  for (const candidateTerm of corpus.candidateTerms) {
    for (const sourceId of candidateTerm.sources) {
      const bucket = buckets.get(sourceId);
      if (bucket !== undefined) bucket.candidateTerms.push(candidateTerm.id);
    }
  }
  for (const alias of corpus.aliases) {
    for (const sourceId of alias.sources) {
      const bucket = buckets.get(sourceId);
      if (bucket !== undefined) bucket.aliases.push(alias.alias);
    }
  }
  for (const relation of corpus.relations) {
    for (const sourceId of relation.sources) {
      const bucket = buckets.get(sourceId);
      if (bucket !== undefined) bucket.relations.push(`${relation.kind}:${relation.from}:${relation.to}`);
    }
  }
  return Object.fromEntries(
    [...buckets.entries()]
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([sourceId, bucket]) => [
        sourceId,
        {
          terms: sortedStrings(bucket.terms),
          candidateTerms: sortedStrings(bucket.candidateTerms),
          parts: sortedStrings(bucket.parts),
          aliases: sortedStrings(bucket.aliases),
          relations: sortedStrings(bucket.relations),
        },
      ]),
  );
}

function segmentationSurfaces(corpus: Corpus): readonly object[] {
  return sortedById(corpus.parts).flatMap((part) => {
    const surface = part.form.replaceAll("-", "").replaceAll("/", "");
    const base = {
      surface,
      partId: part.id,
      transformations: [],
    };
    return part.kind === "combiningForm" && surface.endsWith("o")
      ? [base, { ...base, surface: surface.slice(0, -1), transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }] }]
      : [base];
  });
}

export function renderGeneratedCorpus(corpus: Corpus): readonly GeneratedOutput[] {
  const terms = [...corpus.terms].sort((left, right) => compareCodePoints(left.slug, right.slug));
  const routes = terms.map((term) => term.slug);
  const sourceData = sortedById(corpus.sources);
  const partData = sortedById(corpus.parts);
  const aliasData = [...corpus.aliases].sort((left, right) => compareCodePoints(left.normalized, right.normalized));
  const candidateTermData = sortedById(corpus.candidateTerms);
  const candidateTermSearchIndex = Object.fromEntries(candidateTermData.map((candidate) => [candidate.normalized, candidate.id]));
  const relationData = [...corpus.relations].sort((left, right) => {
    const leftKey = `${left.kind}:${left.from}:${left.to}`;
    const rightKey = `${right.kind}:${right.from}:${right.to}`;
    return compareCodePoints(leftKey, rightKey);
  });
  const termSlugById = new Map(terms.map((term) => [term.id, term.slug]));
  const termRouteIndex = Object.fromEntries([
    ...terms.map((term) => [term.normalized, term.slug] as const),
    ...aliasData.flatMap((alias) => {
      const slug = termSlugById.get(alias.termId);
      return slug === undefined ? [] : [[alias.normalized, slug] as const];
    }),
  ].sort(([left], [right]) => compareCodePoints(left, right)));
  return [
    {
      filename: "corpus.ts",
      contents: `${generatedHeader}\n\nexport const corpus = ${json({ sources: sourceData, parts: partData, terms, aliases: aliasData, relations: relationData })} as const;\n`,
    },
    {
      filename: "candidates.ts",
      contents: `${generatedHeader}\n\n${generatedCandidateType}\n\nexport const candidateTerms: readonly CandidateTerm[] = ${json(candidateTermData)};\n`,
    },
    {
      filename: "index.ts",
      contents: `${generatedHeader}\n\nexport const termSearchIndex = ${json(Object.fromEntries(terms.map((term) => [term.normalized, term.id])))} as const;\n\nexport const candidateTermSearchIndex = ${json(candidateTermSearchIndex)} as const;\n\nexport const termRouteIndex = ${json(termRouteIndex)} as const;\n\nexport const partToTermUsage = ${json(reversePartUsage(corpus))} as const;\n\nexport const relatedTermIds = ${json(relatedTerms(corpus))} as const;\n\nexport const sourceCitations = ${json(citations(corpus))} as const;\n`,
    },
    {
      filename: "routes.ts",
      contents: `${generatedHeader}\n\nexport const routeSlugs = ${json(routes)} as const;\n`,
    },
    {
      filename: "segmentation.ts",
      contents: `${generatedHeader}\n\nexport const candidateSurfaces = ${json(segmentationSurfaces(corpus))} as const;\n`,
    },
  ];
}

export function buildGeneratedCorpus(corpus: Corpus, destination: string): void {
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".openword-generated-"));
  try {
    for (const output of renderGeneratedCorpus(corpus)) {
      writeFileSync(join(staging, output.filename), output.contents);
    }
    rmSync(destination, { recursive: true, force: true });
    renameSync(staging, destination);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
