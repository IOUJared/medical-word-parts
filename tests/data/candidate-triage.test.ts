import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  candidateTriageCategories,
  candidateTriageReportJson,
  createCandidateTriageReport,
  isProtectedTriageOutputPath,
} from "../../src/data/candidate-triage";
import { loadCorpus, validateCorpus, type Corpus } from "../../src/data";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

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
      candidate("candidate:pre-root-ia", "prerootia"),
      candidate("candidate:pre-x-root-ia", "prexrootia"),
      candidate("candidate:pre-root-missing", "prerootmissing"),
      candidate("candidate:root-missing-ia", "rootmissingia"),
      candidate("candidate:pre-unknown-ia", "preunknownia"),
      candidate("candidate:unknown", "unknown"),
      candidate("candidate:heart-failure", "heart failure"),
      candidate("candidate:type2", "type2"),
    ],
    candidateDispositions: [],
    candidateReviewDecisions: [
      {
        candidateId: "candidate:unknown",
        outcome: "deferred",
        reason: "insufficient_decomposition_evidence",
        reviewSources: ["source:test"],
        note: "The reviewed source does not document an exact word-part analysis.",
      },
    ],
    relations: [],
  };
}

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

function runCandidateTriage(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "candidate:triage", "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function runCandidateTriageCheck(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "candidate:triage:check", "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

describe("candidate verification triage", () => {
  it("classifies candidates without inventing word-part meanings", () => {
    const report = createCandidateTriageReport(testCorpus());

    expect(report.schemaVersion).toBe(3);
    expect(report.summary).toEqual({
      verifiedTermCount: 1,
      candidateTermCount: 9,
      pendingReviewCandidateCount: 8,
      deferredCandidateCount: 1,
      categoryCounts: {
        verified_collision: 1,
        complete_known_parts: 1,
        partial_known_parts: 4,
        no_known_parts: 1,
        phrase_candidate: 1,
        unsupported_characters: 1,
      },
    });
    expect(report.categories.map((group) => group.category)).toEqual(candidateTriageCategories);
    expect(report.categories.flatMap((group) => group.candidates.map((item) => item.id))).toEqual([
      "candidate:verified",
      "candidate:pre-root-ia",
      "candidate:pre-root-missing",
      "candidate:pre-unknown-ia",
      "candidate:pre-x-root-ia",
      "candidate:root-missing-ia",
      "candidate:unknown",
      "candidate:heart-failure",
      "candidate:type2",
    ]);
    expect(report.categories[1]?.candidates[0]).toMatchObject({
      category: "complete_known_parts",
      normalized: "prerootia",
      knownSegments: [
        { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
        { partId: "root:root", surface: "root", start: 3, end: 7 },
        { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
      ],
      unresolvedSpans: [],
    });
    expect(candidateTriageReportJson(report)).not.toContain("before");
    expect(candidateTriageReportJson(report)).not.toContain("condition");
  });

  it("reports the resolved production queue as intentionally empty", () => {
    const report = createCandidateTriageReport(validateCorpus(loadCorpus("data")));

    expect(report.summary).toMatchObject({
      verifiedTermCount: 298,
      candidateTermCount: 0,
      pendingReviewCandidateCount: 0,
      deferredCandidateCount: 0,
    });
  });

  it("groups unresolved surfaces and ranks candidates for batch review", () => {
    const report = createCandidateTriageReport(testCorpus());

    expect(report.batchReview.unresolvedSurfaceGroups.slice(0, 2)).toEqual([
      {
        surface: "missing",
        occurrenceCount: 2,
        candidateCount: 2,
        occurrences: [
          { candidateId: "candidate:pre-root-missing", start: 7, end: 14 },
          { candidateId: "candidate:root-missing-ia", start: 4, end: 11 },
        ],
      },
      {
        surface: "unknown",
        occurrenceCount: 1,
        candidateCount: 1,
        occurrences: [
          { candidateId: "candidate:pre-unknown-ia", start: 3, end: 10 },
        ],
      },
    ]);
    expect(report.batchReview.rankedCandidates.slice(0, 3)).toEqual([
      {
        rank: 1,
        candidateId: "candidate:pre-root-missing",
        category: "partial_known_parts",
        knownCoveragePercent: 50,
        unresolvedSpanCount: 1,
        tinyUnresolvedSpanCount: 0,
        unresolvedCharacterCount: 7,
        sourceCount: 1,
      },
      {
        rank: 2,
        candidateId: "candidate:root-missing-ia",
        category: "partial_known_parts",
        knownCoveragePercent: 46,
        unresolvedSpanCount: 1,
        tinyUnresolvedSpanCount: 0,
        unresolvedCharacterCount: 7,
        sourceCount: 1,
      },
      {
        rank: 3,
        candidateId: "candidate:pre-unknown-ia",
        category: "partial_known_parts",
        knownCoveragePercent: 42,
        unresolvedSpanCount: 1,
        tinyUnresolvedSpanCount: 0,
        unresolvedCharacterCount: 7,
        sourceCount: 1,
      },
    ]);
    expect(report.batchReview.deferredCandidates).toEqual([
      {
        candidateId: "candidate:unknown",
        reason: "insufficient_decomposition_evidence",
        reviewSources: ["source:test"],
        note: "The reviewed source does not document an exact word-part analysis.",
      },
    ]);
    expect(report.batchReview.rankedCandidates.map((candidate) => candidate.candidateId)).not.toContain("candidate:unknown");
    expect(report.batchReview.unresolvedSurfaceGroups.flatMap((group) => group.occurrences))
      .not.toContainEqual(expect.objectContaining({ candidateId: "candidate:unknown" }));
    expect(report.batchReview.rankedCandidates.find((candidate) => candidate.candidateId === "candidate:pre-x-root-ia"))
      .toMatchObject({ tinyUnresolvedSpanCount: 1 });
    expect(report.batchReview.rankedCandidates.map((candidate) => candidate.candidateId).indexOf("candidate:pre-x-root-ia"))
      .toBeGreaterThan(report.batchReview.rankedCandidates.map((candidate) => candidate.candidateId).indexOf("candidate:unknown"));
    const reportJson = candidateTriageReportJson(report);
    expect(reportJson).not.toContain("suggestedMeaning");
    expect(reportJson).not.toContain("suggestedPartKind");
  });

  it("renders deterministic JSON", () => {
    const report = createCandidateTriageReport(testCorpus());

    expect(candidateTriageReportJson(report)).toBe(candidateTriageReportJson(createCandidateTriageReport(testCorpus())));
    expect(JSON.parse(candidateTriageReportJson(report))).toEqual(report);
  });

  it("guards authoritative output paths", () => {
    expect(isProtectedTriageOutputPath(join(repositoryRoot, "data", "candidate-report.json"))).toBe(true);
    expect(isProtectedTriageOutputPath(join(repositoryRoot, "src", "generated", "candidate-report.json"))).toBe(true);
    expect(isProtectedTriageOutputPath(join(repositoryRoot, "public", "generated", "candidate-report.json"))).toBe(true);
    expect(isProtectedTriageOutputPath(join(repositoryRoot, ".artifacts", "candidate-report.json"))).toBe(false);
  });

  it("writes and checks a deterministic report without touching authoritative data", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-triage-"));
    const output = join(directory, "candidate-verification-triage.json");
    try {
      expect(runCandidateTriage(["--output", output]).status).toBe(0);
      const generated = readFileSync(output, "utf8");
      expect(JSON.parse(generated)).toMatchObject({ schemaVersion: 3, batchReview: expect.any(Object) });
      expect(runCandidateTriageCheck(["--output", output]).status).toBe(0);

      writeFileSync(output, "{}\n");
      const stale = runCandidateTriageCheck(["--output", output]);
      expect(stale.status).not.toBe(0);
      expect(readFileSync(output, "utf8")).toBe("{}\n");
      expect(stale.output).toContain("stale");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects authoritative output paths before writing", () => {
    const output = join(repositoryRoot, "data", "candidate-verification-triage.json");

    const outcome = runCandidateTriage(["--output", output]);

    expect(outcome.status).not.toBe(0);
    expect(outcome.output).toContain("refusing to write");
    expect(existsSync(output)).toBe(false);
  });
});
