import { describe, expect, it } from "vitest";

import { checkCandidateBatchCoverage } from "../../src/data/candidate-batch-coverage";
import { candidateManifestJson, createCandidateManifest } from "../../src/data/candidate-manifest";

const sourceHash = "d".repeat(64);
const manifestJson = candidateManifestJson(createCandidateManifest([
  { id: "candidate:one", normalized: "one" },
  { id: "candidate:two", normalized: "two" },
  { id: "candidate:deferred", normalized: "deferred" },
], sourceHash));

function decompositionBatch(candidateIds: readonly string[]): string {
  return JSON.stringify({
    schemaVersion: 1,
    summary: {
      candidateTermCount: 3,
      deferredCandidateCount: 1,
      reviewableCandidateCount: 2,
      includedCandidateCount: candidateIds.length,
      readyForTermDraftCount: 0,
      needsWordPartSourcesCount: candidateIds.length,
      needsPhraseReviewCount: 0,
      unsupportedCharactersCount: 0,
      batchSize: 100,
      batchNumber: 1,
      batchStart: candidateIds.length === 0 ? 0 : 1,
      batchEnd: candidateIds.length,
      remainingCandidateCount: 0,
    },
    candidates: candidateIds.map((candidateId) => ({
      candidateId,
      term: candidateId,
      normalized: candidateId.replace("candidate:", ""),
      category: "no_known_parts",
      status: "needs_word_part_sources",
      sources: ["source:test"],
      sourceVersion: "fixture",
      knownSegments: [],
      unresolvedSpans: [{ surface: "term", start: 0, end: 4 }],
      reviewTodo: "Find source-backed word parts before drafting the term analysis.",
    })),
  });
}

function check(artifact: string): void {
  checkCandidateBatchCoverage({
    workflow: "decomposition",
    manifestJson,
    currentSourceSha256: sourceHash,
    excludedCandidateIds: ["candidate:deferred"],
    artifacts: [{ path: "batch.json", body: artifact }],
  });
}

describe("candidate decomposition batch coverage", () => {
  it("accounts for included candidates and deterministic exclusions", () => {
    const summary = checkCandidateBatchCoverage({
      workflow: "decomposition",
      manifestJson,
      currentSourceSha256: sourceHash,
      excludedCandidateIds: ["candidate:deferred"],
      artifacts: [{ path: "batch.json", body: decompositionBatch(["candidate:one", "candidate:two"]) }],
    });

    expect(summary).toMatchObject({ includedCandidateCount: 2, excludedCandidateCount: 1, accountedCandidateCount: 3 });
  });

  it("rejects malformed decomposition artifacts and excluded candidate entries", () => {
    expect(() => check("{")).toThrow();
    expect(() => check(JSON.stringify({ schemaVersion: 1, summary: {}, candidates: [] }))).toThrow();
    expect(() => check(decompositionBatch(["candidate:one", "candidate:two", "candidate:deferred"]))).toThrow();
  });
});
