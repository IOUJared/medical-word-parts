import { describe, expect, it } from "vitest";

import {
  candidateDefinitionBatchJson,
  createCandidateDefinitionBatch,
  type MeshDefinitionClient,
} from "../../src/data/candidate-definition-batch";
import type { Corpus } from "../../src/data";

function candidate(id: string, normalized: string, meshDescriptor?: string): Corpus["candidateTerms"][number] {
  return {
    id,
    term: normalized,
    normalized,
    status: "candidate",
    sources: meshDescriptor === undefined ? ["source:test"] : ["source:mesh-terms"],
    sourceVersion: meshDescriptor === undefined ? "fixture" : "MeSH descriptor export",
    license: meshDescriptor === undefined ? "fixture license" : "MeSH free reuse with NLM acknowledgement",
    ...(meshDescriptor === undefined ? {} : { externalIds: { meshDescriptor } }),
  };
}

function testCorpus(): Corpus {
  return {
    sources: [
      { id: "source:test", publisher: "Test", title: "Test Source", url: "https://example.test/source" },
      { id: "source:mesh-terms", publisher: "NLM", title: "MeSH", url: "https://example.test/mesh" },
    ],
    parts: [],
    terms: [],
    aliases: [],
    candidateTerms: [
      candidate("candidate:abscess", "abscess", "D000038"),
      candidate("candidate:homeostasis", "homeostasis"),
      candidate("candidate:deferred", "deferred", "D999999"),
    ],
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
    candidateTerms: Array.from({ length: candidateCount }, (_, index) => {
      const number = String(index + 1).padStart(3, "0");
      return candidate(`candidate:word-${number}`, `word${number}`);
    }),
    candidateReviewDecisions: [],
  };
}

function fixtureClient(): MeshDefinitionClient {
  return {
    async definitionForDescriptor(descriptorId) {
      return {
        descriptorId,
        descriptorLabel: "Abscess",
        conceptId: "M0000059",
        definition: "Accumulation of purulent material in tissues.",
        definitionUrl: "https://id.nlm.nih.gov/mesh/M0000059",
      };
    },
  };
}


describe("candidate definition batch", () => {
  it("collects MeSH definitions and source-review leads without reviewing candidates one by one", async () => {
    const report = await createCandidateDefinitionBatch(testCorpus(), fixtureClient());

    expect(report.schemaVersion).toBe(1);
    expect(report.summary).toEqual({
      candidateTermCount: 3,
      deferredCandidateCount: 1,
      includedCandidateCount: 2,
      meshDefinitionCount: 1,
      sourceReviewLeadCount: 1,
      failedDefinitionCount: 0,
      batchSize: 2,
      batchNumber: 1,
      batchStart: 1,
      batchEnd: 2,
      remainingCandidateCount: 0,
    });
    expect(report.candidates).toEqual([
      {
        candidateId: "candidate:abscess",
        term: "abscess",
        normalized: "abscess",
        status: "mesh_definition",
        candidateSources: ["source:mesh-terms"],
        sourceVersion: "MeSH descriptor export",
        definition: {
          sourceId: "source:mesh-terms",
          sourceName: "MeSH",
          descriptorId: "D000038",
          descriptorLabel: "Abscess",
          conceptId: "M0000059",
          text: "Accumulation of purulent material in tissues.",
          url: "https://id.nlm.nih.gov/mesh/M0000059",
        },
      },
      {
        candidateId: "candidate:homeostasis",
        term: "homeostasis",
        normalized: "homeostasis",
        status: "source_review_required",
        candidateSources: ["source:test"],
        sourceLeads: [
          {
            sourceId: "source:test",
            sourceName: "Test Source",
            url: "https://example.test/source",
          },
        ],
      },
    ]);
    expect(candidateDefinitionBatchJson(report)).toBe(candidateDefinitionBatchJson(report));
  });

  it("creates numbered 100-word batches from the pending candidate queue", async () => {
    const firstBatch = await createCandidateDefinitionBatch(largeTestCorpus(250), fixtureClient(), { batchSize: 100 });
    const thirdBatch = await createCandidateDefinitionBatch(largeTestCorpus(250), fixtureClient(), {
      batchSize: 100,
      batchNumber: 3,
    });

    expect(firstBatch.summary).toMatchObject({
      candidateTermCount: 250,
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

});
