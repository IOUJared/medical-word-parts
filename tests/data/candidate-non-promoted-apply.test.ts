import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { candidateManifestJson, candidateTermsSha256, createCandidateManifest } from "../../src/data/candidate-manifest";
import {
  applyArguments,
  applyReadyPromotion,
  decompositionBatch,
  readJson,
  readyPromotionBatch,
  run,
  sha256,
  withFixture,
  writeJson,
} from "./candidate-non-promoted-apply-fixture";

describe("candidate non-promoted disposition apply", () => {
  it("Given ready, partial, no-known, phrase, and pre-deferred candidates, when promotion and disposition apply run, then the active queue is empty and dispositions are complete", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      const promotionPath = join(directory, "promotion.json");
      writeFileSync(promotionPath, readyPromotionBatch());
      expect(run("candidate:promote:apply", [
        "--data", directory,
        "--manifest", manifestPath,
        "--decomposition", promotionPath,
        "--decomposition-sha256", sha256(readFileSync(promotionPath, "utf8")),
      ]).status).toBe(0);

      const result = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(result.status).toBe(0);
      expect(JSON.parse(result.output)).toMatchObject({
        appliedCandidateCount: 4,
        remainingCandidateCount: 0,
        totalDispositionCount: 5,
        remainingReviewDecisionCount: 0,
      });
      expect(readJson(join(directory, "candidate-terms.json"))).toEqual({ candidateTerms: [] });
      expect(readJson(join(directory, "candidate-review-decisions.json"))).toEqual({ candidateReviewDecisions: [] });
      expect(readJson(join(directory, "candidate-dispositions.json"))).toMatchObject({
        candidateDispositions: expect.arrayContaining([
          expect.objectContaining({ originalCandidateId: "candidate:ready", outcome: "promoted_verified_term" }),
          expect.objectContaining({ originalCandidateId: "candidate:partial", outcome: "source_review_required" }),
          expect.objectContaining({ originalCandidateId: "candidate:none", outcome: "deferred_insufficient_evidence" }),
          expect.objectContaining({ originalCandidateId: "candidate:phrase", outcome: "deferred_phrase_review" }),
          expect.objectContaining({ originalCandidateId: "candidate:deferred", outcome: "deferred_schema_incompatible" }),
        ]),
      });
      expect(run("data:validate", ["--data", directory]).status).toBe(0);
      const evidenceDirectory = process.env["CANDIDATE_APPLY_EVIDENCE_DIR"];
      if (evidenceDirectory !== undefined) cpSync(directory, evidenceDirectory, { recursive: true });
    });
  });

  it("Given an active promotable candidate, when non-promoted apply runs, then it refuses the batch without mutation", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      writeFileSync(decompositionPath, decompositionBatch(1, true));
      const before = [
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
      ];

      const result = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(result.status).not.toBe(0);
      expect(result.output).toContain("candidate:ready is promotable");
      expect([
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
      ]).toEqual(before);
    });
  });

  it("Given an active window candidate missing from the decomposition artifact, when apply runs, then it refuses without mutation", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      expect(applyReadyPromotion(directory, manifestPath)).toBe(0);
      const batch = JSON.parse(decompositionBatch());
      batch.candidates = batch.candidates.filter(
        (entry: { readonly candidateId: string }) => entry.candidateId !== "candidate:none",
      );
      batch.summary.includedCandidateCount = batch.candidates.length;
      batch.summary.needsWordPartSourcesCount -= 1;
      batch.summary.batchEnd = batch.candidates.length;
      writeJson(decompositionPath, batch);
      const before = [
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
        readFileSync(join(directory, "candidate-review-decisions.json"), "utf8"),
      ];

      const result = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(result.status).not.toBe(0);
      expect(result.output).toContain("candidate:none is missing from decomposition batch 1");
      expect([
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
        readFileSync(join(directory, "candidate-review-decisions.json"), "utf8"),
      ]).toEqual(before);
    });
  });

  it("Given a frozen manifest, when the candidate source drifts, then apply refuses it", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      const document = readJson(join(directory, "candidate-terms.json"));
      if (typeof document !== "object" || document === null || !("candidateTerms" in document) || !Array.isArray(document.candidateTerms)) {
        throw new TypeError("fixture candidate document is malformed");
      }
      document.candidateTerms.reverse();
      writeJson(join(directory, "candidate-terms.json"), document);

      const result = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(result.status).not.toBe(0);
      expect(result.output).toContain("candidate source hash drifted from frozen manifest");
    });
  });

  it("Given a phrase candidate matching a schema-valid term, when apply runs, then it links the verified term instead of deferring the phrase", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      expect(applyReadyPromotion(directory, manifestPath)).toBe(0);
      const document = readJson(join(directory, "candidate-terms.json"));
      if (typeof document !== "object" || document === null || !("candidateTerms" in document) || !Array.isArray(document.candidateTerms)) {
        throw new TypeError("fixture candidate document is malformed");
      }
      const phrase = document.candidateTerms.find((entry) => entry.id === "candidate:phrase");
      phrase.term = "sample";
      phrase.normalized = "sample";
      writeJson(join(directory, "candidate-terms.json"), document);
      const manifest = createCandidateManifest(
        document.candidateTerms.map((entry) => ({ id: entry.id, normalized: entry.normalized })),
        candidateTermsSha256(readFileSync(join(directory, "candidate-terms.json"))),
      );
      writeFileSync(manifestPath, candidateManifestJson(manifest));
      const batch = JSON.parse(decompositionBatch());
      const phraseEntry = batch.candidates.find((entry: { readonly candidateId: string }) => entry.candidateId === "candidate:phrase");
      phraseEntry.term = "sample";
      phraseEntry.normalized = "sample";
      phraseEntry.unresolvedSpans = [{ surface: "sample", start: 0, end: 6 }];
      writeJson(decompositionPath, batch);

      const result = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(result.status).toBe(0);
      expect(readJson(join(directory, "candidate-dispositions.json"))).toMatchObject({
        candidateDispositions: expect.arrayContaining([
          expect.objectContaining({ originalCandidateId: "candidate:phrase", outcome: "promoted_verified_term", promotedTermId: "term:sample" }),
        ]),
      });
    });
  });

  it("Given malformed decomposition input, when apply runs, then missing outcome fields are rejected", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      const batch = JSON.parse(decompositionBatch());
      delete batch.candidates[0].unresolvedSpans;
      writeJson(decompositionPath, batch);

      const result = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(result.status).not.toBe(0);
      expect(result.output).toContain("unresolvedSpans");
    });
  });

  it("Given batch two while batch one is incomplete, when apply runs, then ordering is enforced", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const orderedIds = manifest.windows[0].candidateIds;
      manifest.windows = [
        { batchNumber: 1, candidateIds: orderedIds.slice(0, -1) },
        { batchNumber: 2, candidateIds: orderedIds.slice(-1) },
      ];
      manifest.summary.windowCount = 2;
      writeJson(manifestPath, manifest);
      const batch = JSON.parse(decompositionBatch(2));
      batch.candidates = batch.candidates.filter((entry: { readonly candidateId: string }) => entry.candidateId === orderedIds.at(-1));
      batch.summary.includedCandidateCount = batch.candidates.length;
      batch.summary.needsWordPartSourcesCount = batch.candidates.length;
      batch.summary.needsPhraseReviewCount = 0;
      writeJson(decompositionPath, batch);

      const result = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath, 2));

      expect(result.status).not.toBe(0);
      expect(result.output).toContain("batch 1 must be completed before batch 2");
    });
  });
});
