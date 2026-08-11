import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { candidateManifestJson, candidateTermsSha256, createCandidateManifest } from "../../src/data/candidate-manifest";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

type Candidate = {
  readonly id: string;
  readonly term: string;
  readonly normalized: string;
  readonly status: "candidate";
  readonly sources: readonly ["source:test"];
  readonly sourceVersion: "fixture";
  readonly license: "fixture license";
};

function candidate(id: string, normalized: string): Candidate {
  return {
    id,
    term: normalized,
    normalized,
    status: "candidate",
    sources: ["source:test"],
    sourceVersion: "fixture",
    license: "fixture license",
  };
}

const candidates = [
  candidate("candidate:ready", "prerootia"),
  candidate("candidate:partial", "rootmissing"),
  candidate("candidate:none", "unknown"),
  candidate("candidate:phrase", "heart failure"),
  candidate("candidate:deferred", "rootdeferred"),
] as const;

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function sha256(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export function run(script: string, arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const result = spawnSync(npmCommand, ["run", "--silent", script, "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function writeFixture(directory: string): void {
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
    analyses: [{
      id: "analysis:sample-primary",
      primary: true,
      segments: [{ partId: "root:sample", surface: "sample", start: 0, end: 6 }],
    }],
  });
  writeJson(join(directory, "word-parts", "prefixes.json"), {
    parts: [{ id: "prefix:pre", kind: "prefix", form: "pre-", meaning: "before", sources: ["source:test"] }],
  });
  writeJson(join(directory, "word-parts", "roots.json"), {
    parts: [
      { id: "root:root", kind: "root", form: "root-", meaning: "root", sources: ["source:test"] },
      { id: "root:sample", kind: "root", form: "sample", meaning: "sample", sources: ["source:test"] },
    ],
  });
  writeJson(join(directory, "word-parts", "suffixes.json"), {
    parts: [{ id: "suffix:ia", kind: "suffix", form: "-ia", meaning: "condition", sources: ["source:test"] }],
  });
  writeJson(join(directory, "word-parts", "combining-forms.json"), {
    parts: [{ id: "combining:cyt-o", kind: "combiningForm", form: "cyt/o", meaning: "cell", sources: ["source:test"] }],
  });
  writeJson(join(directory, "candidate-terms.json"), { candidateTerms: candidates });
  writeJson(join(directory, "candidate-review-decisions.json"), {
    candidateReviewDecisions: [{
      candidateId: "candidate:deferred",
      outcome: "deferred",
      reason: "term_schema_incompatible",
      reviewSources: ["source:test"],
      note: "The existing review found a schema limitation.",
    }],
  });
  writeJson(join(directory, "candidate-dispositions.json"), { candidateDispositions: [] });
}

function writeManifest(directory: string, manifestPath: string): void {
  const candidateTermsPath = join(directory, "candidate-terms.json");
  writeFileSync(manifestPath, candidateManifestJson(createCandidateManifest(
    candidates.map((entry) => ({ id: entry.id, normalized: entry.normalized })),
    candidateTermsSha256(readFileSync(candidateTermsPath)),
  )));
}

export function decompositionBatch(batchNumber = 1, includeReady = false): string {
  const entries = [
    ...(includeReady ? [{
      candidateId: "candidate:ready", term: "prerootia", normalized: "prerootia", category: "complete_known_parts", status: "ready_for_term_draft", sources: ["source:test"], sourceVersion: "fixture",
      knownSegments: [
        { partId: "prefix:pre", surface: "pre", start: 0, end: 3 }, { partId: "root:root", surface: "root", start: 3, end: 7 }, { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
      ], unresolvedSpans: [], reviewTodo: "Ready for promotion.",
    }] : []),
    { candidateId: "candidate:partial", term: "rootmissing", normalized: "rootmissing", category: "partial_known_parts", status: "needs_word_part_sources", sources: ["source:test"], sourceVersion: "fixture", knownSegments: [{ partId: "root:root", surface: "root", start: 0, end: 4 }], unresolvedSpans: [{ surface: "missing", start: 4, end: 11 }], reviewTodo: "Find a source for the unresolved span." },
    { candidateId: "candidate:none", term: "unknown", normalized: "unknown", category: "no_known_parts", status: "needs_word_part_sources", sources: ["source:test"], sourceVersion: "fixture", knownSegments: [], unresolvedSpans: [{ surface: "unknown", start: 0, end: 7 }], reviewTodo: "Find source-backed word parts." },
    { candidateId: "candidate:phrase", term: "heart failure", normalized: "heart failure", category: "phrase_candidate", status: "needs_phrase_review", sources: ["source:test"], sourceVersion: "fixture", knownSegments: [], unresolvedSpans: [{ surface: "heart failure", start: 0, end: 13 }], reviewTodo: "Review phrase handling." },
  ];
  return `${JSON.stringify({ schemaVersion: 1, summary: { candidateTermCount: 5, deferredCandidateCount: 1, reviewableCandidateCount: 4, includedCandidateCount: entries.length, readyForTermDraftCount: includeReady ? 1 : 0, needsWordPartSourcesCount: 2, needsPhraseReviewCount: 1, unsupportedCharactersCount: 0, batchSize: 100, batchNumber, batchStart: 1, batchEnd: entries.length, remainingCandidateCount: 0 }, candidates: entries }, null, 2)}\n`;
}

export function readyPromotionBatch(): string {
  const batch = JSON.parse(decompositionBatch(1, true));
  batch.candidates = [batch.candidates[0]];
  batch.summary.includedCandidateCount = 1;
  batch.summary.needsWordPartSourcesCount = 0;
  batch.summary.needsPhraseReviewCount = 0;
  batch.summary.batchEnd = 1;
  return `${JSON.stringify(batch, null, 2)}\n`;
}

export function withFixture(test: (directory: string, manifestPath: string, decompositionPath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "candidate-disposition-apply-"));
  try {
    writeFixture(directory);
    const manifestPath = join(directory, "manifest.json");
    const decompositionPath = join(directory, "decomposition.json");
    writeManifest(directory, manifestPath);
    writeFileSync(decompositionPath, decompositionBatch());
    test(directory, manifestPath, decompositionPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function applyArguments(directory: string, manifestPath: string, decompositionPath: string, batch = 1): readonly string[] {
  return ["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readFileSync(decompositionPath, "utf8")), "--batch", String(batch)];
}

export function applyReadyPromotion(directory: string, manifestPath: string): number | null {
  const promotionPath = join(directory, "promotion.json");
  writeFileSync(promotionPath, readyPromotionBatch());
  return run("candidate:promote:apply", ["--data", directory, "--manifest", manifestPath, "--decomposition", promotionPath, "--decomposition-sha256", sha256(readFileSync(promotionPath, "utf8"))]).status;
}
