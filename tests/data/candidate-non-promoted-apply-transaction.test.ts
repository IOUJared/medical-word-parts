import { cpSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applyCandidateNonPromotedDispositions } from "../../src/data/candidate-non-promoted-apply";
import {
  applyArguments,
  applyReadyPromotion,
  readJson,
  run,
  sha256,
  withFixture,
  writeJson,
} from "./candidate-non-promoted-apply-fixture";

describe("candidate non-promoted disposition apply", () => {
  it("Given a disposition-only interrupted write, when the same batch reruns repeatedly, then it recovers once and becomes an idempotent no-op", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      expect(applyReadyPromotion(directory, manifestPath)).toBe(0);
      const dispositionDocument = readJson(join(directory, "candidate-dispositions.json"));
      if (typeof dispositionDocument !== "object" || dispositionDocument === null
        || !("candidateDispositions" in dispositionDocument) || !Array.isArray(dispositionDocument.candidateDispositions)) {
        throw new TypeError("fixture disposition document is malformed");
      }
      writeJson(join(directory, "candidate-dispositions.json"), {
        candidateDispositions: [...dispositionDocument.candidateDispositions, {
          originalCandidateId: "candidate:deferred",
          originalTerm: "rootdeferred",
          originalNormalized: "rootdeferred",
          outcome: "deferred_schema_incompatible",
          reviewSources: ["source:test"],
          note: "The existing review found a schema limitation.",
        }],
      });

      const first = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));
      const afterFirst = [
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-review-decisions.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
      ];
      const second = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(first.status).toBe(0);
      expect(second.status).toBe(0);
      expect(JSON.parse(second.output)).toMatchObject({ appliedCandidateCount: 0, remainingCandidateCount: 0 });
      expect([
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-review-decisions.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
      ]).toEqual(afterFirst);
    });
  });

  it("Given a real failure after the first authoritative rename, when disposition apply reruns, then it rolls forward before loading and removes transaction artifacts", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      expect(applyReadyPromotion(directory, manifestPath)).toBe(0);
      const input = { dataDirectory: directory, manifestPath, decompositionPath, expectedDecompositionSha256: sha256(readFileSync(decompositionPath, "utf8")), batchNumber: 1 } as const;

      expect(() => applyCandidateNonPromotedDispositions(input, {
        afterRename(completedRenameCount) {
          if (completedRenameCount === 1) throw new Error("injected ENOSPC after first authoritative rename");
        },
      })).toThrow("injected ENOSPC");
      expect(existsSync(join(directory, ".candidate-apply-transaction.json"))).toBe(true);
      const evidenceDirectory = process.env["CANDIDATE_APPLY_INTERRUPTION_EVIDENCE_DIR"];
      if (evidenceDirectory !== undefined) cpSync(directory, join(evidenceDirectory, "disposition-interrupted"), { recursive: true });

      const first = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));
      const settled = [
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-review-decisions.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
      ];
      const second = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(first.status).toBe(0);
      expect(second.status).toBe(0);
      expect(JSON.parse(second.output)).toMatchObject({ appliedCandidateCount: 0, remainingCandidateCount: 0 });
      expect(readdirSync(directory).filter((name) => name.includes("candidate-apply"))).toEqual([]);
      expect(settled).toEqual([
        readFileSync(join(directory, "candidate-terms.json"), "utf8"),
        readFileSync(join(directory, "candidate-review-decisions.json"), "utf8"),
        readFileSync(join(directory, "candidate-dispositions.json"), "utf8"),
      ]);
    });
  });

  it("Given an interrupted transaction whose pending target drifted, when disposition apply reruns, then it refuses to overwrite the stale state", () => {
    withFixture((directory, manifestPath, decompositionPath) => {
      expect(applyReadyPromotion(directory, manifestPath)).toBe(0);
      const input = { dataDirectory: directory, manifestPath, decompositionPath, expectedDecompositionSha256: sha256(readFileSync(decompositionPath, "utf8")), batchNumber: 1 } as const;
      expect(() => applyCandidateNonPromotedDispositions(input, {
        afterRename(completedRenameCount) {
          if (completedRenameCount === 1) throw new Error("injected ENOSPC after first authoritative rename");
        },
      })).toThrow("injected ENOSPC");
      const reviewPath = join(directory, "candidate-review-decisions.json");
      writeJson(reviewPath, { candidateReviewDecisions: [{
        candidateId: "candidate:deferred",
        outcome: "deferred",
        reason: "term_schema_incompatible",
        reviewSources: ["source:test"],
        note: "Externally changed while the transaction was interrupted.",
      }] });
      const drifted = readFileSync(reviewPath, "utf8");

      const outcome = run("candidate:dispose:apply", applyArguments(directory, manifestPath, decompositionPath));

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("transaction target drifted: candidate-review-decisions.json");
      expect(readFileSync(reviewPath, "utf8")).toBe(drifted);
      expect(existsSync(join(directory, ".candidate-apply-transaction.json"))).toBe(true);
    });
  });
});
