import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  candidateManifestJson,
  createCandidateManifest,
} from "../../src/data/candidate-manifest";
import {
  CandidateDispositionArchiveError,
  checkCandidateDispositionArchive,
} from "../../src/data/validate-candidate-dispositions";
import {
  archivedCandidateManifest,
  deferredDisposition,
  fixtureCandidateSourceSha256,
  validate,
  validateArchive,
  withFixture,
  writeDispositions,
  writeManifest,
} from "./candidate-dispositions-validation-fixture";

describe("candidate disposition validation", () => {
  it("Given a frozen pre-apply manifest, an empty active queue, and complete dispositions, when archive validation is requested, then the final archive is accepted", () => {
    withFixture((directory) => {
      const manifestPath = writeManifest(directory, fixtureCandidateSourceSha256(directory), [
        { id: "candidate:diabetes", normalized: "diabetes" },
      ]);
      writeFileSync(join(directory, "candidate-terms.json"), '{"candidateTerms":[]}\n');
      writeFileSync(join(directory, "candidate-review-decisions.json"), '{"candidateReviewDecisions":[]}\n');
      writeDispositions(directory, [deferredDisposition]);

      const outcome = validateArchive(directory, manifestPath);

      expect(outcome.status).toBe(0);
    });
  });

  it("Given stale original identity for an active candidate, when validated, then the mismatch is rejected", () => {
    withFixture((directory) => {
      writeDispositions(directory, [{ ...deferredDisposition, originalNormalized: "different" }]);
      const outcome = validate(directory);
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("original identity does not match active candidate candidate:diabetes");
    });
  });

  it("Given a frozen manifest with a wrong candidate identity, when archive validation is requested, then the production command rejects it", () => {
    withFixture((directory) => {
      const manifestPath = writeManifest(directory, fixtureCandidateSourceSha256(directory), [
        { id: "candidate:diabetes", normalized: "different" },
      ]);

      const outcome = validateArchive(directory, manifestPath);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("active candidate identity does not match frozen manifest candidate:diabetes");
    });
  });

  it("Given a candidate that is both active and archived, when archive validation is requested, then the production command rejects the identity collision", () => {
    withFixture((directory) => {
      writeDispositions(directory, [deferredDisposition]);
      const manifestPath = writeManifest(directory, fixtureCandidateSourceSha256(directory), [
        { id: "candidate:diabetes", normalized: "diabetes" },
      ]);

      const outcome = validateArchive(directory, manifestPath);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("active candidate identity collision candidate:diabetes");
    });
  });

  it("Given a one-record archive and a frozen manifest with another candidate, when archive validation is requested, then the production command rejects missing coverage", () => {
    withFixture((directory) => {
      writeDispositions(directory, [deferredDisposition]);
      const manifestPath = writeManifest(directory, fixtureCandidateSourceSha256(directory), [
        { id: "candidate:diabetes", normalized: "diabetes" },
        { id: "candidate:missing", normalized: "missing" },
      ]);
      writeFileSync(join(directory, "candidate-terms.json"), '{"candidateTerms":[]}\n');
      writeFileSync(join(directory, "candidate-review-decisions.json"), '{"candidateReviewDecisions":[]}\n');

      const outcome = validateArchive(directory, manifestPath);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("candidate disposition archive is missing 1 candidate IDs from frozen manifest");
    });
  });

  it("Given a stale source hash in a frozen manifest, when archive validation is requested, then the production command rejects the stale state", () => {
    withFixture((directory) => {
      writeDispositions(directory, [deferredDisposition]);
      const manifestPath = writeManifest(directory, "0".repeat(64), [
        { id: "candidate:diabetes", normalized: "diabetes" },
      ]);

      const outcome = validateArchive(directory, manifestPath);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("candidate source hash drifted from frozen manifest");
    });
  });

  it("Given a malformed frozen manifest, when archive validation is requested, then the production command rejects the input", () => {
    withFixture((directory) => {
      const manifestPath = join(directory, "candidate-manifest.json");
      writeFileSync(manifestPath, "{\n");

      const outcome = validateArchive(directory, manifestPath);

      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("invalid candidate disposition manifest");
    });
  });

  it("Given one disposition, when checked against the frozen 1,057-candidate manifest, then the missing 1,056 IDs are rejected", () => {
    const { manifestJson, sourceSha256, firstDisposition } = archivedCandidateManifest();

    expect(() => checkCandidateDispositionArchive({
      manifestJson,
      currentSourceSha256: sourceSha256,
      activeCandidates: [],
      dispositions: [firstDisposition],
    })).toThrow(new CandidateDispositionArchiveError("candidate disposition archive is missing 1056 candidate IDs from frozen manifest"));
  });

  it("Given a disposition archive checked against a stale candidate source hash, when checked, then it rejects the stale state", () => {
    const { manifestJson } = archivedCandidateManifest();

    expect(() => checkCandidateDispositionArchive({
      manifestJson,
      currentSourceSha256: "0".repeat(64),
      activeCandidates: [{ id: "candidate:abdominal-injuries", normalized: "abdominal injuries" }],
      dispositions: [],
    })).toThrow(new CandidateDispositionArchiveError("candidate source hash drifted from frozen manifest"));
  });

  it("Given duplicate and extra disposition IDs, when checked against a frozen manifest, then both archive integrity violations are rejected", () => {
    const manifestJson = candidateManifestJson(createCandidateManifest([
      { id: "candidate:diabetes", normalized: "diabetes" },
    ], "a".repeat(64)));

    expect(() => checkCandidateDispositionArchive({
      manifestJson,
      currentSourceSha256: "a".repeat(64),
      activeCandidates: [],
      dispositions: [deferredDisposition, deferredDisposition],
    })).toThrow(new CandidateDispositionArchiveError("duplicate candidate disposition candidate:diabetes"));
    expect(() => checkCandidateDispositionArchive({
      manifestJson,
      currentSourceSha256: "a".repeat(64),
      activeCandidates: [],
      dispositions: [{ ...deferredDisposition, originalCandidateId: "candidate:extra" }],
    })).toThrow(new CandidateDispositionArchiveError("stale candidate ID candidate:extra"));
  });

  it("Given an archived disposition with stale original identity, when checked against an empty queue and frozen manifest, then it is rejected", () => {
    const manifestJson = candidateManifestJson(createCandidateManifest([
      { id: "candidate:diabetes", normalized: "diabetes" },
    ], "a".repeat(64)));

    expect(() => checkCandidateDispositionArchive({
      manifestJson,
      currentSourceSha256: "a".repeat(64),
      activeCandidates: [],
      dispositions: [{ ...deferredDisposition, originalNormalized: "different" }],
    })).toThrow(new CandidateDispositionArchiveError("original identity does not match frozen manifest candidate:diabetes"));
  });
});
