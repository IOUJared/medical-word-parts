import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createFixture } from "./fixture";

export const semanticFixtureIssues = [
  "wrong-source-namespace",
  "wrong-term-namespace",
  "wrong-analysis-namespace",
  "wrong-prefix-namespace",
  "wrong-root-namespace",
  "wrong-suffix-namespace",
  "wrong-combining-namespace",
  "alias-normalized-mismatch",
  "term-normalized-mismatch",
  "duplicate-analysis-within-term",
  "duplicate-analysis-across-terms",
  "drop-at-end",
  "drop-before-unresolved",
  "drop-before-root",
  "drop-before-combining",
  "drop-before-consonant-suffix",
] as const;

export type SemanticFixtureIssue = (typeof semanticFixtureIssues)[number];

const source = {
  id: "source:test",
  publisher: "Test publisher",
  title: "Test source",
  url: "https://example.test/source",
} as const;

const sampleSegments = [
  { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
  { partId: "root:root", surface: "root", start: 3, end: 7 },
  { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
] as const;

const sampleAnalysis = {
  id: "analysis:sample",
  primary: true,
  segments: sampleSegments,
} as const;

const sampleTerm = {
  id: "term:sample",
  slug: "sample",
  term: "prerootia",
  normalized: "prerootia",
  sources: ["source:test"],
  note: "A test term record.",
  analyses: [sampleAnalysis],
} as const;

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTerm(directory: string, value: unknown, filename = "sample.json"): void {
  writeJson(join(directory, "terms", filename), value);
}

function writePart(directory: string, filename: string, value: unknown): void {
  writeJson(join(directory, "word-parts", filename), { parts: [value] });
}

function writeDropTerm(directory: string, term: string, segments: readonly object[]): void {
  writeTerm(directory, {
    ...sampleTerm,
    term,
    normalized: term,
    analyses: [{ ...sampleAnalysis, segments }],
  });
}

export function createSemanticFixture(issue: SemanticFixtureIssue): string {
  const directory = createFixture();
  switch (issue) {
    case "wrong-source-namespace":
      writeJson(join(directory, "sources.json"), { sources: [{ ...source, id: "term:test" }] });
      break;
    case "wrong-term-namespace":
      writeTerm(directory, { ...sampleTerm, id: "source:sample" });
      break;
    case "wrong-analysis-namespace":
      writeTerm(directory, { ...sampleTerm, analyses: [{ ...sampleAnalysis, id: "term:sample" }] });
      break;
    case "wrong-prefix-namespace":
      writePart(directory, "prefixes.json", {
        id: "root:pre",
        kind: "prefix",
        form: "pre-",
        meaning: "before",
        sources: ["source:test"],
      });
      break;
    case "wrong-root-namespace":
      writePart(directory, "roots.json", {
        id: "prefix:root",
        kind: "root",
        form: "root-",
        meaning: "test root",
        sources: ["source:test"],
      });
      break;
    case "wrong-suffix-namespace":
      writePart(directory, "suffixes.json", {
        id: "root:ia",
        kind: "suffix",
        form: "-ia",
        meaning: "condition",
        sources: ["source:test"],
      });
      break;
    case "wrong-combining-namespace":
      writePart(directory, "combining-forms.json", {
        id: "root:cyt-o",
        kind: "combiningForm",
        form: "cyt/o",
        meaning: "cell",
        sources: ["source:test"],
      });
      break;
    case "alias-normalized-mismatch":
      writeJson(join(directory, "aliases.json"), {
        aliases: [{ alias: "samplealias", normalized: "different", termId: "term:sample", sources: ["source:test"] }],
      });
      break;
    case "term-normalized-mismatch":
      writeTerm(directory, { ...sampleTerm, normalized: "different" });
      break;
    case "duplicate-analysis-within-term":
      writeTerm(directory, { ...sampleTerm, analyses: [sampleAnalysis, { ...sampleAnalysis, primary: false }] });
      break;
    case "duplicate-analysis-across-terms":
      writeTerm(directory, {
        id: "term:second",
        slug: "second",
        term: "rootia",
        normalized: "rootia",
        sources: ["source:test"],
        note: "A second test term record.",
        analyses: [{
          ...sampleAnalysis,
          primary: true,
          segments: [
            { partId: "root:root", surface: "root", start: 0, end: 4 },
            { partId: "suffix:ia", surface: "ia", start: 4, end: 6 },
          ],
        }],
      }, "second.json");
      break;
    case "drop-at-end":
      writeDropTerm(directory, "cyt", [
        { partId: "combining:cyt-o", surface: "cyt", start: 0, end: 3, transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }] },
      ]);
      break;
    case "drop-before-unresolved":
      writeDropTerm(directory, "cytxia", [
        { partId: "combining:cyt-o", surface: "cyt", start: 0, end: 3, transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }] },
        { partId: "suffix:ia", surface: "ia", start: 4, end: 6 },
      ]);
      break;
    case "drop-before-root":
      writeDropTerm(directory, "cytroot", [
        { partId: "combining:cyt-o", surface: "cyt", start: 0, end: 3, transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }] },
        { partId: "root:root", surface: "root", start: 3, end: 7 },
      ]);
      break;
    case "drop-before-combining":
      writeDropTerm(directory, "cytcyto", [
        { partId: "combining:cyt-o", surface: "cyt", start: 0, end: 3, transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }] },
        { partId: "combining:cyt-o", surface: "cyto", start: 3, end: 7 },
      ]);
      break;
    case "drop-before-consonant-suffix":
      writePart(directory, "suffixes.json", {
        id: "suffix:kine",
        kind: "suffix",
        form: "-kine",
        meaning: "test suffix",
        sources: ["source:test"],
      });
      writeDropTerm(directory, "cytkine", [
        { partId: "combining:cyt-o", surface: "cyt", start: 0, end: 3, transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }] },
        { partId: "suffix:kine", surface: "kine", start: 3, end: 7 },
      ]);
      break;
    default:
      issue satisfies never;
  }
  return directory;
}

export function createValidDropFixture(): string {
  const directory = createFixture();
  writePart(directory, "combining-forms.json", {
    id: "combining:glyc-o",
    kind: "combiningForm",
    form: "glyc/o",
    meaning: "sugar",
    sources: ["source:test"],
  });
  writePart(directory, "suffixes.json", {
    id: "suffix:emia",
    kind: "suffix",
    form: "-emia",
    meaning: "blood condition",
    sources: ["source:test"],
  });
  writeDropTerm(directory, "glycemia", [
    { partId: "combining:glyc-o", surface: "glyc", start: 0, end: 4, transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }] },
    { partId: "suffix:emia", surface: "emia", start: 4, end: 8 },
  ]);
  return directory;
}
