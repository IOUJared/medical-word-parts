import { describe, expect, it } from "vitest";

import {
  candidateManifestJson,
  createCandidateManifest,
  parseCandidateManifestJson,
} from "../../src/data/candidate-manifest";

const sourceHash = "a".repeat(64);

function candidate(id: string, normalized: string): { readonly id: string; readonly normalized: string } {
  return { id, normalized };
}

describe("candidate manifest", () => {
  it("creates deterministic source-ordered windows of at most one hundred candidates", () => {
    const candidates = [
      candidate("candidate:zeta", "zeta"),
      candidate("candidate:alpha-two", "alpha"),
      candidate("candidate:alpha-one", "alpha"),
      ...Array.from({ length: 100 }, (_, index) => candidate(`candidate:word-${index}`, `word${index}`)),
    ];

    const manifest = createCandidateManifest(candidates, sourceHash);

    expect(manifest.candidates.slice(0, 3).map((entry) => entry.id)).toEqual([
      "candidate:alpha-one",
      "candidate:alpha-two",
      "candidate:word-0",
    ]);
    expect(manifest.windows.map((window) => window.candidateIds.length)).toEqual([100, 3]);
    expect(candidateManifestJson(manifest)).toBe(candidateManifestJson(createCandidateManifest(candidates, sourceHash)));
  });

  it("rejects malformed JSON and invalid manifest invariants", () => {
    expect(() => parseCandidateManifestJson("{")).toThrow();
    expect(() => parseCandidateManifestJson(JSON.stringify({ schemaVersion: 1 }))).toThrow();
    expect(() => parseCandidateManifestJson(JSON.stringify({
      schemaVersion: 1,
      source: { candidateTermsSha256: sourceHash, candidateCount: 1 },
      summary: { candidateCount: 1, windowCount: 1, maxWindowSize: 100 },
      candidates: [{ id: "candidate:one", normalized: "one" }],
      windows: [{ batchNumber: 2, candidateIds: ["candidate:one"] }],
    }))).toThrow();
  });
});
