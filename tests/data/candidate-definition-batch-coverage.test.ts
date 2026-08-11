import { describe, expect, it } from "vitest";

import { candidateManifestJson, createCandidateManifest } from "../../src/data/candidate-manifest";
import { checkCandidateBatchCoverage } from "../../src/data/candidate-batch-coverage";

const sourceHash = "b".repeat(64);
const manifestJson = candidateManifestJson(createCandidateManifest([
  { id: "candidate:one", normalized: "one" },
  { id: "candidate:two", normalized: "two" },
  { id: "candidate:three", normalized: "three" },
], sourceHash));

function definitionBatch(candidateIds: readonly string[]): string {
  return JSON.stringify({
    schemaVersion: 1,
    summary: {
      candidateTermCount: 3,
      deferredCandidateCount: 0,
      includedCandidateCount: candidateIds.length,
      meshDefinitionCount: 0,
      sourceReviewLeadCount: candidateIds.length,
      failedDefinitionCount: 0,
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
      candidateSources: ["source:test"],
      status: "source_review_required",
      sourceLeads: [{ sourceId: "source:test", sourceName: "Test", url: "https://example.test" }],
    })),
  });
}

function check(artifacts: readonly string[], currentSourceSha256 = sourceHash): void {
  checkCandidateBatchCoverage({
    workflow: "definition",
    manifestJson,
    currentSourceSha256,
    excludedCandidateIds: [],
    artifacts: artifacts.map((body, index) => ({ path: `batch-${index}.json`, body })),
  });
}

describe("candidate definition batch coverage", () => {
  it("reports machine-readable exact-once totals", () => {
    const summary = checkCandidateBatchCoverage({
      workflow: "definition",
      manifestJson,
      currentSourceSha256: sourceHash,
      excludedCandidateIds: [],
      artifacts: [{ path: "batch.json", body: definitionBatch(["candidate:one", "candidate:two", "candidate:three"]) }],
    });

    expect(summary).toMatchObject({
      workflow: "definition",
      manifestCandidateCount: 3,
      includedCandidateCount: 3,
      excludedCandidateCount: 0,
      accountedCandidateCount: 3,
      artifactCount: 1,
    });
  });

  it("rejects missing, duplicate, stale, oversized, and malformed definition artifacts", () => {
    expect(() => check([definitionBatch(["candidate:one", "candidate:two"])])).toThrow();
    expect(() => check([definitionBatch(["candidate:one", "candidate:two", "candidate:one"])] )).toThrow();
    expect(() => check([definitionBatch(["candidate:one", "candidate:two", "candidate:three"])], "c".repeat(64))).toThrow();
    expect(() => check([definitionBatch(Array.from({ length: 101 }, (_, index) => `candidate:oversized-${index}`))])).toThrow();
    expect(() => check(["{"])).toThrow();
    expect(() => check([JSON.stringify({ schemaVersion: 1, summary: {}, candidates: [] })])).toThrow();
  });
});
