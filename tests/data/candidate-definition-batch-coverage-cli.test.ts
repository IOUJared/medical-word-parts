import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

type CommandResult = {
  readonly status: number | null;
  readonly output: string;
  readonly stdout: string;
};

function runCommand(script: string, arguments_: readonly string[]): CommandResult {
  const outcome = spawnSync(npmCommand, ["run", script, "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}`, stdout: outcome.stdout };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFixtureData(directory: string): void {
  mkdirSync(join(directory, "terms"), { recursive: true });
  mkdirSync(join(directory, "word-parts"), { recursive: true });
  writeJson(join(directory, "sources.json"), {
    sources: [{ id: "source:test", publisher: "Test", title: "Test Source", url: "https://example.test/source" }],
  });
  writeJson(join(directory, "aliases.json"), { aliases: [] });
  writeJson(join(directory, "relations.json"), { relations: [] });
  writeJson(join(directory, "candidate-terms.json"), {
    candidateTerms: [{
      id: "candidate:homeostasis",
      term: "homeostasis",
      normalized: "homeostasis",
      status: "candidate",
      sources: ["source:test"],
      sourceVersion: "fixture",
      license: "fixture license",
    }],
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

function coverageSummary(result: CommandResult): unknown {
  const line = result.stdout.split(/\r?\n/).find((value) => value.startsWith("{"));
  return JSON.parse(line ?? "");
}

describe("candidate batch coverage CLIs", () => {
  it("exits nonzero for invalid definition and decomposition coverage inputs", () => {
    const definition = runCommand("candidate:definitions:coverage", ["--manifest", "missing.json", "--batches", "missing"]);
    const decomposition = runCommand("candidate:decompose:coverage", ["--manifest", "missing.json", "--batches", "missing"]);

    expect(definition.status).not.toBe(0);
    expect(decomposition.status).not.toBe(0);
  });

  it("writes a frozen manifest and reports JSON totals for both batch workflows", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-coverage-"));
    try {
      const dataDirectory = join(directory, "data");
      const manifestPath = join(directory, "candidate-manifest.json");
      const definitionDirectory = join(directory, "definition-batches");
      const decompositionDirectory = join(directory, "decomposition-batches");
      writeFixtureData(dataDirectory);
      mkdirSync(definitionDirectory);
      mkdirSync(decompositionDirectory);

      expect(runCommand("candidate:manifest", ["--data", dataDirectory, "--output", manifestPath]).status).toBe(0);
      expect(runCommand("candidate:manifest:check", ["--data", dataDirectory, "--output", manifestPath]).status).toBe(0);
      expect(runCommand("candidate:definitions", ["--data", dataDirectory, "--batch-size", "100", "--output", join(definitionDirectory, "001.json")]).status).toBe(0);
      expect(runCommand("candidate:decompose", ["--data", dataDirectory, "--batch-size", "100", "--output", join(decompositionDirectory, "001.json")]).status).toBe(0);

      const definitionCoverage = runCommand("candidate:definitions:coverage", ["--data", dataDirectory, "--manifest", manifestPath, "--batches", definitionDirectory]);
      const decompositionCoverage = runCommand("candidate:decompose:coverage", ["--data", dataDirectory, "--manifest", manifestPath, "--batches", decompositionDirectory]);

      expect(definitionCoverage.status).toBe(0);
      expect(coverageSummary(definitionCoverage)).toMatchObject({ workflow: "definition", manifestCandidateCount: 1, accountedCandidateCount: 1 });
      expect(decompositionCoverage.status).toBe(0);
      expect(coverageSummary(decompositionCoverage)).toMatchObject({ workflow: "decomposition", manifestCandidateCount: 1, accountedCandidateCount: 1 });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
