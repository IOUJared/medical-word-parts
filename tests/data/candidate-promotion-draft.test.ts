import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { createCandidatePromotionDraft } from "../../src/data/candidate-promotion-draft";
import type { Corpus } from "../../src/data";

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
      {
        id: "candidate:verified",
        term: "verified",
        normalized: "verified",
        status: "candidate",
        sources: ["source:test"],
        sourceVersion: "fixture",
        license: "fixture license",
      },
      {
        id: "candidate:pre-root-missing",
        term: "prerootmissing",
        normalized: "prerootmissing",
        status: "candidate",
        sources: ["source:test"],
        sourceVersion: "fixture",
        license: "fixture license",
      },
    ],
    candidateDispositions: [],
    candidateReviewDecisions: [],
    relations: [],
  };
}

function runCandidatePromotionDraft(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "candidate:promote:draft", "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFixtureData(directory: string): void {
  mkdirSync(join(directory, "terms"), { recursive: true });
  mkdirSync(join(directory, "word-parts"), { recursive: true });
  writeJson(join(directory, "sources.json"), {
    sources: [{ id: "source:test", publisher: "Test", title: "Test", url: "https://example.test/source" }],
  });
  writeJson(join(directory, "aliases.json"), { aliases: [] });
  writeJson(join(directory, "relations.json"), { relations: [] });
  writeJson(join(directory, "candidate-terms.json"), {
    candidateTerms: [
      {
        id: "candidate:pre-root-missing",
        term: "prerootmissing",
        normalized: "prerootmissing",
        status: "candidate",
        sources: ["source:test"],
        sourceVersion: "fixture",
        license: "fixture license",
      },
    ],
  });
  writeJson(join(directory, "candidate-review-decisions.json"), { candidateReviewDecisions: [] });
  writeJson(join(directory, "candidate-dispositions.json"), { candidateDispositions: [] });
  writeJson(join(directory, "word-parts", "prefixes.json"), {
    parts: [{ id: "prefix:pre", kind: "prefix", form: "pre-", meaning: "before", sources: ["source:test"] }],
  });
  writeJson(join(directory, "word-parts", "roots.json"), {
    parts: [{ id: "root:root", kind: "root", form: "root-", meaning: "root", sources: ["source:test"] }],
  });
  writeJson(join(directory, "word-parts", "suffixes.json"), {
    parts: [{ id: "suffix:ia", kind: "suffix", form: "-ia", meaning: "condition", sources: ["source:test"] }],
  });
  writeJson(join(directory, "word-parts", "combining-forms.json"), {
    parts: [{ id: "combining:test-o", kind: "combiningForm", form: "test/o", meaning: "test", sources: ["source:test"] }],
  });
}

describe("candidate promotion draft", () => {
  it("creates a deterministic draft with known segments and unresolved TODO spans", () => {
    const draft = createCandidatePromotionDraft(testCorpus(), "candidate:pre-root-missing");

    expect(draft).toEqual({
      id: "term:prerootmissing",
      slug: "prerootmissing",
      term: "prerootmissing",
      normalized: "prerootmissing",
      sources: ["source:test"],
      note: "TODO: replace with a source-cited word-part teaching note before moving this draft into data/terms.",
      analyses: [
        {
          id: "analysis:prerootmissing-primary",
          primary: true,
          segments: [
            { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
            { partId: "root:root", surface: "root", start: 3, end: 7 },
          ],
        },
      ],
      draftReview: {
        candidateId: "candidate:pre-root-missing",
        status: "needs_source_verified_completion",
        unresolvedSpans: [{ surface: "missing", start: 7, end: 14, todo: "Source and add this word part before promotion." }],
      },
    });
    expect(JSON.stringify(draft)).not.toContain("condition");
    expect(JSON.stringify(draft)).not.toContain("suggestedMeaning");
  });

  it("refuses unknown and already verified candidates", () => {
    expect(() => createCandidatePromotionDraft(testCorpus(), "candidate:missing")).toThrow("unknown candidate");
    expect(() => createCandidatePromotionDraft(testCorpus(), "candidate:verified")).toThrow("verified term");
  });

  it("writes drafts under artifacts and refuses overwrite by default", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-draft-"));
    try {
      const dataDirectory = join(directory, "data");
      const outputDirectory = join(directory, "drafts");
      writeFixtureData(dataDirectory);
      const first = runCandidatePromotionDraft([
        "--candidate",
        "candidate:pre-root-missing",
        "--data",
        dataDirectory,
        "--output",
        outputDirectory,
      ]);
      expect(first.status).toBe(0);
      const output = join(outputDirectory, "prerootmissing.json");
      expect(existsSync(output)).toBe(true);
      const generated = readFileSync(output, "utf8");
      expect(JSON.parse(generated)).toMatchObject({ id: "term:prerootmissing", draftReview: expect.any(Object) });
      expect(generated).not.toContain("suggestedMeaning");

      writeFileSync(output, "{}\n");
      const second = runCandidatePromotionDraft([
        "--candidate",
        "candidate:pre-root-missing",
        "--data",
        dataDirectory,
        "--output",
        outputDirectory,
      ]);
      expect(second.status).not.toBe(0);
      expect(second.output).toContain("already exists");
      expect(readFileSync(output, "utf8")).toBe("{}\n");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
