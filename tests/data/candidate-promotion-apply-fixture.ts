import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

import { candidateManifestJson, candidateTermsSha256, createCandidateManifest } from "../../src/data/candidate-manifest";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const promotionSummarySchema = z.strictObject({
  promotedCandidateCount: z.number().int().nonnegative(),
  createdTermIds: z.array(z.string()),
  removedCandidateIds: z.array(z.string()),
  dispositionCandidateIds: z.array(z.string()),
});

export type PromotionSummary = z.infer<typeof promotionSummarySchema>;

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function runApply(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "--silent", "candidate:promote:apply", "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

export function parseSummary(output: string): PromotionSummary {
  return promotionSummarySchema.parse(JSON.parse(output));
}

export function writeFixtureData(directory: string): void {
  mkdirSync(join(directory, "terms"), { recursive: true });
  mkdirSync(join(directory, "word-parts"), { recursive: true });
  writeJson(join(directory, "sources.json"), {
    sources: [{ id: "source:test", publisher: "Test", title: "Test", url: "https://example.test/source" }],
  });
  writeJson(join(directory, "aliases.json"), { aliases: [] });
  writeJson(join(directory, "relations.json"), { relations: [] });
  writeJson(join(directory, "terms", "sample.json"), {
    id: "term:sample",
    slug: "sample",
    term: "sample",
    normalized: "sample",
    sources: ["source:test"],
    note: "A verified fixture term.",
    analyses: [{ id: "analysis:sample-primary", primary: true, segments: [{ partId: "root:sample", surface: "sample", start: 0, end: 6 }] }],
  });
  writeJson(join(directory, "word-parts", "prefixes.json"), {
    parts: [{ id: "prefix:pre", kind: "prefix", form: "pre-", meaning: "before", sources: ["source:test"] }],
  });
  writeJson(join(directory, "word-parts", "roots.json"), {
    parts: [
      { id: "root:root", kind: "root", form: "root-", meaning: "root", sources: ["source:test"] },
      { id: "root:algia", kind: "root", form: "algia", meaning: "pain", sources: ["source:test"] },
      { id: "root:sample", kind: "root", form: "sample", meaning: "sample", sources: ["source:test"] },
    ],
  });
  writeJson(join(directory, "word-parts", "suffixes.json"), {
    parts: [{ id: "suffix:ia", kind: "suffix", form: "-ia", meaning: "condition", sources: ["source:test"] }],
  });
  writeJson(join(directory, "word-parts", "combining-forms.json"), {
    parts: [{ id: "combining:cyt-o", kind: "combiningForm", form: "cyt/o", meaning: "cell", sources: ["source:test"] }],
  });
  writeJson(join(directory, "candidate-terms.json"), {
    candidateTerms: [
      {
        id: "candidate:prerootia",
        term: "prerootia",
        normalized: "prerootia",
        status: "candidate",
        sources: ["source:test"],
        sourceVersion: "fixture",
        license: "fixture license",
      },
      {
        id: "candidate:prealgia",
        term: "prealgia",
        normalized: "prealgia",
        status: "candidate",
        sources: ["source:test"],
        sourceVersion: "fixture",
        license: "fixture license",
      },
    ],
  });
  writeJson(join(directory, "candidate-review-decisions.json"), { candidateReviewDecisions: [] });
  writeJson(join(directory, "candidate-dispositions.json"), { candidateDispositions: [] });
}

export function writeManifest(directory: string, outputPath: string): void {
  const candidateTermsPath = join(directory, "candidate-terms.json");
  const bytes = readFileSync(candidateTermsPath);
  writeFileSync(outputPath, candidateManifestJson(createCandidateManifest([
    { id: "candidate:prerootia", normalized: "prerootia" },
    { id: "candidate:prealgia", normalized: "prealgia" },
  ], candidateTermsSha256(bytes))));
}

export function readyBatch(candidateIds: readonly string[]): string {
  const candidates = candidateIds.map((candidateId) => ({
    candidateId,
    term: candidateId === "candidate:prerootia" ? "prerootia" : "prealgia",
    normalized: candidateId === "candidate:prerootia" ? "prerootia" : "prealgia",
    category: "complete_known_parts",
    status: "ready_for_term_draft",
    sources: ["source:test"],
    sourceVersion: "fixture",
    knownSegments: candidateId === "candidate:prerootia"
      ? [
          { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
          { partId: "root:root", surface: "root", start: 3, end: 7 },
          { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
        ]
      : [
          { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
          { partId: "root:algia", surface: "algia", start: 3, end: 8 },
        ],
    unresolvedSpans: [],
    reviewTodo: "Ready for promotion.",
  }));
  return `${JSON.stringify({
    schemaVersion: 1,
    summary: {
      candidateTermCount: 2,
      deferredCandidateCount: 0,
      reviewableCandidateCount: 2,
      includedCandidateCount: candidates.length,
      readyForTermDraftCount: candidates.length,
      needsWordPartSourcesCount: 0,
      needsPhraseReviewCount: 0,
      unsupportedCharactersCount: 0,
      batchSize: 100,
      batchNumber: 1,
      batchStart: 0,
      batchEnd: candidates.length,
      remainingCandidateCount: 0,
    },
    candidates,
  }, null, 2)}\n`;
}

export function withFixture(test: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "candidate-promotion-apply-"));
  try {
    writeFixtureData(directory);
    test(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
