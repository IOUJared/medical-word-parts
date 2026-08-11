import { describe, expect, it } from "vitest";

import {
  candidateDecompositionBatchJson,
  createCandidateDecompositionBatch,
} from "../../src/data/candidate-decomposition-batch";
import { parseCandidateDecompositionBatchArtifactJson } from "../../src/data/candidate-batch-artifacts";
import { parseCandidateDecompositionBatchJson } from "../../src/data/candidate-decomposition-batch-check";
import type { Corpus } from "../../src/data";

function candidate(id: string, normalized: string): Corpus["candidateTerms"][number] {
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

function testCorpus(): Corpus {
  return {
    sources: [{ id: "source:test", publisher: "Test", title: "Test", url: "https://example.test/source" }],
    parts: [
      { id: "prefix:pre", kind: "prefix", form: "pre-", meaning: "before", sources: ["source:test"] },
      { id: "root:root", kind: "root", form: "root-", meaning: "root", sources: ["source:test"] },
      { id: "suffix:ia", kind: "suffix", form: "-ia", meaning: "condition", sources: ["source:test"] },
    ],
    terms: [
      {
        id: "term:verified",
        slug: "verified",
        term: "verified",
        normalized: "verified",
        sources: ["source:test"],
        note: "Verified fixture.",
        analyses: [{ id: "analysis:verified", primary: true, segments: [] }],
      },
    ],
    aliases: [],
    candidateTerms: [
      candidate("candidate:verified", "verified"),
      candidate("candidate:complete", "prerootia"),
      candidate("candidate:partial", "prerootmissing"),
      candidate("candidate:none", "unknown"),
      candidate("candidate:phrase", "heart failure"),
      candidate("candidate:unsupported", "type2"),
      candidate("candidate:deferred", "rootmissingia"),
    ],
    candidateDispositions: [],
    candidateReviewDecisions: [
      {
        candidateId: "candidate:deferred",
        outcome: "deferred",
        reason: "insufficient_decomposition_evidence",
        reviewSources: ["source:test"],
        note: "Already reviewed.",
      },
    ],
    relations: [],
  };
}

function largeTestCorpus(candidateCount: number): Corpus {
  return {
    ...testCorpus(),
    terms: [],
    candidateTerms: Array.from({ length: candidateCount }, (_, index) => {
      const number = String(index + 1).padStart(3, "0");
      return candidate(`candidate:word-${number}`, `word${number}`);
    }),
    candidateReviewDecisions: [],
  };
}

describe("candidate decomposition batch", () => {
  it("creates review entries with known segments and unresolved spans", () => {
    const batch = createCandidateDecompositionBatch(testCorpus());

    expect(batch.schemaVersion).toBe(1);
    expect(batch.summary).toEqual({
      candidateTermCount: 7,
      deferredCandidateCount: 1,
      reviewableCandidateCount: 5,
      includedCandidateCount: 5,
      readyForTermDraftCount: 1,
      needsWordPartSourcesCount: 2,
      needsPhraseReviewCount: 1,
      unsupportedCharactersCount: 1,
      batchSize: 100,
      batchNumber: 1,
      batchStart: 1,
      batchEnd: 7,
      remainingCandidateCount: 0,
    });
    expect(batch.candidates.map((candidate) => candidate.candidateId)).toEqual([
      "candidate:complete",
      "candidate:partial",
      "candidate:none",
      "candidate:phrase",
      "candidate:unsupported",
    ]);
    expect(batch.candidates[0]).toMatchObject({
      status: "ready_for_term_draft",
      knownSegments: [
        { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
        { partId: "root:root", surface: "root", start: 3, end: 7 },
        { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
      ],
      unresolvedSpans: [],
    });
    expect(batch.candidates[1]).toMatchObject({
      status: "needs_word_part_sources",
      unresolvedSpans: [{ surface: "missing", start: 7, end: 14 }],
    });
  });

  it("creates numbered 100-candidate decomposition batches", () => {
    const firstBatch = createCandidateDecompositionBatch(largeTestCorpus(250), { batchSize: 100 });
    const thirdBatch = createCandidateDecompositionBatch(largeTestCorpus(250), {
      batchSize: 100,
      batchNumber: 3,
    });

    expect(firstBatch.summary).toMatchObject({
      reviewableCandidateCount: 250,
      includedCandidateCount: 100,
      batchSize: 100,
      batchNumber: 1,
      batchStart: 1,
      batchEnd: 100,
      remainingCandidateCount: 150,
    });
    expect(firstBatch.candidates[0]?.candidateId).toBe("candidate:word-001");
    expect(firstBatch.candidates.at(-1)?.candidateId).toBe("candidate:word-100");
    expect(thirdBatch.summary).toMatchObject({
      includedCandidateCount: 50,
      batchSize: 100,
      batchNumber: 3,
      batchStart: 201,
      batchEnd: 250,
      remainingCandidateCount: 0,
    });
    expect(thirdBatch.candidates[0]?.candidateId).toBe("candidate:word-201");
    expect(thirdBatch.candidates.at(-1)?.candidateId).toBe("candidate:word-250");
  });

  it("uses the first frozen 100-candidate window by default and leaves later windows for explicit batches", () => {
    // Given: a reviewable corpus whose source queue spans three frozen windows.
    const corpus = largeTestCorpus(250);
    const defaultBatch = createCandidateDecompositionBatch(corpus);
    const explicitBatches = [1, 2, 3].map((batchNumber) => createCandidateDecompositionBatch(corpus, {
      batchSize: 100,
      batchNumber,
    }));

    // When: default selection omits the batch options while subsequent windows are selected explicitly.
    const explicitCandidateIds = explicitBatches.flatMap((batch) => batch.candidates.map((candidate) => candidate.candidateId));

    // Then: the default artifact is strict-parser compatible and all explicit windows cover the queue once.
    expect(defaultBatch.candidates).toHaveLength(100);
    expect(defaultBatch.summary).toMatchObject({ batchSize: 100, batchNumber: 1, batchStart: 1, batchEnd: 100, remainingCandidateCount: 150 });
    expect(defaultBatch.candidates.map((candidate) => candidate.candidateId)).toEqual(explicitBatches[0]?.candidates.map((candidate) => candidate.candidateId));
    expect(() => parseCandidateDecompositionBatchArtifactJson(candidateDecompositionBatchJson(defaultBatch))).not.toThrow();
    expect(new Set(explicitCandidateIds)).toEqual(new Set(corpus.candidateTerms.map((candidate) => candidate.id)));
    expect(explicitCandidateIds).toHaveLength(250);
  });

  it("keeps decomposition candidates inside their frozen source window when earlier candidates are excluded", () => {
    const corpus = largeTestCorpus(201);
    const candidateTerms = [...corpus.candidateTerms];
    const first = candidateTerms[0];
    if (first === undefined) throw new Error("fixture must contain a first candidate");
    const batch = createCandidateDecompositionBatch({
      ...corpus,
      candidateReviewDecisions: [{
        candidateId: first.id,
        outcome: "deferred",
        reason: "insufficient_decomposition_evidence",
        reviewSources: ["source:test"],
        note: "Already reviewed.",
      }],
    }, { batchSize: 100, batchNumber: 1 });

    expect(batch.candidates.map((candidate) => candidate.candidateId)).not.toContain("candidate:word-101");
    expect(batch.candidates).toHaveLength(99);
  });

  it("rejects saved batch candidates without decomposition review fields", () => {
    const batch = createCandidateDecompositionBatch(testCorpus());
    const incompleteCandidates = batch.candidates.map(({ knownSegments: _knownSegments, ...candidate }) => candidate);

    expect(() => parseCandidateDecompositionBatchJson(JSON.stringify({ ...batch, candidates: incompleteCandidates }))).toThrow();
  });
});
