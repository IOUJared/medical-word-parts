import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSummary, readText, readyBatch, runApply, sha256, withFixture, writeJson, writeManifest } from "./candidate-promotion-apply-fixture";

describe("candidate promotion apply", () => {
  it("Given a partial candidate, when apply runs, then it fails without mutating data files", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      const batch = JSON.parse(readyBatch(["candidate:prerootia"]));
      batch.candidates[0].category = "partial_known_parts";
      writeJson(decompositionPath, batch);
      const before = [readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json"))];

      const outcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("not promotable");
      expect([readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json"))]).toEqual(before);
    });
  });

  it("Given a ready candidate, when apply runs, then it creates a valid term, disposition, and removes the queue entry", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, readyBatch(["candidate:prerootia"]));

      const outcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(outcome.status).toBe(0);
      expect(parseSummary(outcome.output)).toEqual({
        promotedCandidateCount: 1,
        createdTermIds: ["term:prerootia"],
        removedCandidateIds: ["candidate:prerootia"],
        dispositionCandidateIds: ["candidate:prerootia"],
      });
      expect(readText(join(directory, "terms", "prerootia.json"))).not.toMatch(/\b(?:TODO|draft|draftReview)\b/i);
      expect(JSON.parse(readText(join(directory, "candidate-terms.json")))).toMatchObject({
        candidateTerms: [{ id: "candidate:prealgia" }],
      });
      expect(JSON.parse(readText(join(directory, "candidate-dispositions.json")))).toMatchObject({
        candidateDispositions: [{ originalCandidateId: "candidate:prerootia", promotedTermId: "term:prerootia" }],
      });
    });
  });

  it("Given an already promoted candidate, when apply reruns, then it is an idempotent no-op", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, readyBatch(["candidate:prerootia"]));
      const args = ["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))] as const;
      expect(runApply(args).status).toBe(0);
      const before = [readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json")), readText(join(directory, "terms", "prerootia.json"))];

      const outcome = runApply(args);

      expect(outcome.status).toBe(0);
      expect(parseSummary(outcome.output)).toMatchObject({ promotedCandidateCount: 0 });
      expect([readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json")), readText(join(directory, "terms", "prerootia.json"))]).toEqual(before);
    });
  });

  it("Given a retry after a term-file-only interruption, when apply reruns, then it completes the promotion", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, readyBatch(["candidate:prerootia"]));
      writeJson(join(directory, "terms", "prerootia.json"), {
        id: "term:prerootia",
        slug: "prerootia",
        term: "prerootia",
        normalized: "prerootia",
        sources: ["source:test"],
        note: "Source-backed word-part analysis promoted from candidate:prerootia.",
        analyses: [{
          id: "analysis:prerootia-primary",
          primary: true,
          segments: [
            { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
            { partId: "root:root", surface: "root", start: 3, end: 7 },
            { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
          ],
        }],
      });

      const outcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(outcome.status).toBe(0);
      expect(parseSummary(outcome.output)).toMatchObject({
        promotedCandidateCount: 0,
        removedCandidateIds: ["candidate:prerootia"],
        dispositionCandidateIds: ["candidate:prerootia"],
      });
      expect(JSON.parse(readText(join(directory, "candidate-terms.json")))).toMatchObject({
        candidateTerms: [{ id: "candidate:prealgia" }],
      });
      expect(JSON.parse(readText(join(directory, "candidate-dispositions.json")))).toMatchObject({
        candidateDispositions: [{ originalCandidateId: "candidate:prerootia", promotedTermId: "term:prerootia" }],
      });
    });
  });

  it("Given a candidate removed before its disposition is persisted, when apply reruns repeatedly, then it records the missing disposition once", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, readyBatch(["candidate:prerootia"]));
      writeJson(join(directory, "terms", "prerootia.json"), {
        id: "term:prerootia",
        slug: "prerootia",
        term: "prerootia",
        normalized: "prerootia",
        sources: ["source:test"],
        note: "Source-backed word-part analysis promoted from candidate:prerootia.",
        analyses: [{
          id: "analysis:prerootia-primary",
          primary: true,
          segments: [
            { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
            { partId: "root:root", surface: "root", start: 3, end: 7 },
            { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
          ],
        }],
      });
      writeJson(join(directory, "candidate-terms.json"), {
        candidateTerms: [{
          id: "candidate:prealgia",
          term: "prealgia",
          normalized: "prealgia",
          status: "candidate",
          sources: ["source:test"],
          sourceVersion: "fixture",
          license: "fixture license",
        }],
      });
      const args = ["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))] as const;

      const recovered = runApply(args);

      expect(recovered.status).toBe(0);
      expect(parseSummary(recovered.output)).toEqual({
        promotedCandidateCount: 0,
        createdTermIds: [],
        removedCandidateIds: [],
        dispositionCandidateIds: ["candidate:prerootia"],
      });
      expect(JSON.parse(readText(join(directory, "candidate-terms.json"))).candidateTerms).toHaveLength(1);
      expect(JSON.parse(readText(join(directory, "candidate-dispositions.json"))).candidateDispositions).toHaveLength(1);
      const afterRecovery = [readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json"))];

      const retry = runApply(args);

      expect(retry.status).toBe(0);
      expect(parseSummary(retry.output)).toEqual({
        promotedCandidateCount: 0,
        createdTermIds: [],
        removedCandidateIds: [],
        dispositionCandidateIds: [],
      });
      expect([readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json"))]).toEqual(afterRecovery);
    });
  });
});
