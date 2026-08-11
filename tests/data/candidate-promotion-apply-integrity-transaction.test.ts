import { cpSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { applyCandidatePromotions } from "../../src/data/candidate-promotion-apply";
import { readText, readyBatch, runApply, sha256, withFixture, writeJson, writeManifest } from "./candidate-promotion-apply-fixture";

describe("candidate promotion apply", () => {
  it("Given an unrelated candidate is also removed, when apply recovers an interrupted promotion, then it rejects the stale state", () => {
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
      writeJson(join(directory, "candidate-terms.json"), { candidateTerms: [] });
      const before = readText(join(directory, "candidate-dispositions.json"));

      const outcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("candidate source hash drifted from frozen manifest");
      expect(readText(join(directory, "candidate-dispositions.json"))).toBe(before);
    });
  });

  it("Given a decomposition whose identity differs from its active candidate, when apply runs, then it refuses the forged input", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      const batch = JSON.parse(readyBatch(["candidate:prerootia"]));
      batch.candidates[0].term = "preia";
      batch.candidates[0].normalized = "preia";
      batch.candidates[0].knownSegments = [
        { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
        { partId: "suffix:ia", surface: "ia", start: 3, end: 5 },
      ];
      writeJson(decompositionPath, batch);
      const before = [readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json"))];

      const outcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("does not match active candidate");
      expect([readText(join(directory, "candidate-terms.json")), readText(join(directory, "candidate-dispositions.json"))]).toEqual(before);
    });
  });

  it("Given stale manifest and decomposition hashes, when apply runs, then stale inputs are rejected before mutation", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, readyBatch(["candidate:prerootia"]));
      const candidateTermsPath = join(directory, "candidate-terms.json");
      const before = readText(candidateTermsPath);
      writeJson(candidateTermsPath, { candidateTerms: [] });

      const manifestOutcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(manifestOutcome.status).not.toBe(0);
      expect(manifestOutcome.output).toContain("candidate source hash drifted");
      writeFileSync(candidateTermsPath, before);
      const decompositionOutcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256("stale")]);
      expect(decompositionOutcome.status).not.toBe(0);
      expect(decompositionOutcome.output).toContain("decomposition batch hash drifted");
      expect(readText(candidateTermsPath)).toBe(before);
    });
  });

  it("Given malformed apply input, when apply runs, then it exits nonzero without mutation", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, "{}\n");
      const before = readText(join(directory, "candidate-terms.json"));

      const outcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("candidate promotion apply");
      expect(readText(join(directory, "candidate-terms.json"))).toBe(before);
    });
  });

  it("Given a real failure after the first authoritative rename, when promotion reruns, then it rolls forward before loading and removes transaction artifacts", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, readyBatch(["candidate:prerootia"]));
      const input = {
        dataDirectory: directory,
        manifestPath,
        decompositionPath,
        expectedDecompositionSha256: sha256(readText(decompositionPath)),
      } as const;

      expect(() => applyCandidatePromotions(input, {
        afterRename(completedRenameCount) {
          if (completedRenameCount === 1) throw new Error("injected ENOSPC after first authoritative rename");
        },
      })).toThrow("injected ENOSPC");
      expect(existsSync(join(directory, ".candidate-apply-transaction.json"))).toBe(true);
      const evidenceDirectory = process.env["CANDIDATE_APPLY_INTERRUPTION_EVIDENCE_DIR"];
      if (evidenceDirectory !== undefined) cpSync(directory, join(evidenceDirectory, "promotion-interrupted"), { recursive: true });

      const arguments_ = ["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", input.expectedDecompositionSha256] as const;
      const outcome = runApply(arguments_);

      expect(outcome.status).toBe(0);
      expect(JSON.parse(readText(join(directory, "candidate-terms.json"))).candidateTerms).toHaveLength(1);
      expect(JSON.parse(readText(join(directory, "candidate-dispositions.json"))).candidateDispositions).toHaveLength(1);
      expect(existsSync(join(directory, "terms", "prerootia.json"))).toBe(true);
      expect(readdirSync(directory).filter((name) => name.includes("candidate-apply"))).toEqual([]);
      expect(readdirSync(join(directory, "terms")).filter((name) => name.includes("candidate-apply"))).toEqual([]);
      expect(runApply(arguments_).status).toBe(0);
    });
  });

  it("Given a malformed durable transaction journal, when promotion starts, then it refuses before loading or mutating the corpus", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "manifest.json");
      const decompositionPath = join(directory, "decomposition.json");
      writeManifest(directory, manifestPath);
      writeFileSync(decompositionPath, readyBatch(["candidate:prerootia"]));
      writeFileSync(join(directory, ".candidate-apply-transaction.json"), "{malformed\n");
      const before = readText(join(directory, "candidate-terms.json"));

      const outcome = runApply(["--data", directory, "--manifest", manifestPath, "--decomposition", decompositionPath, "--decomposition-sha256", sha256(readText(decompositionPath))]);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("transaction journal is malformed");
      expect(readText(join(directory, "candidate-terms.json"))).toBe(before);
    });
  });
});
