import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { isProtectedDefinitionOutputPath } from "../../src/data/candidate-definition-batch";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runCandidateDefinitions(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "candidate:definitions", "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function runCandidateDefinitionsCheck(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "candidate:definitions:check", "--", ...arguments_], {
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
    sources: [{ id: "source:test", publisher: "Test", title: "Test Source", url: "https://example.test/source" }],
  });
  writeJson(join(directory, "aliases.json"), { aliases: [] });
  writeJson(join(directory, "relations.json"), { relations: [] });
  writeJson(join(directory, "candidate-terms.json"), {
    candidateTerms: [
      {
        id: "candidate:homeostasis",
        term: "homeostasis",
        normalized: "homeostasis",
        status: "candidate",
        sources: ["source:test"],
        sourceVersion: "fixture",
        license: "fixture license",
      },
    ],
  });
  writeJson(join(directory, "candidate-review-decisions.json"), { candidateReviewDecisions: [] });
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

describe("candidate definition batch CLI", () => {
  it("writes and checks a deterministic 100-word definition artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-definitions-"));
    const output = join(directory, "candidate-definition-batch.json");
    try {
      const dataDirectory = join(directory, "data");
      writeFixtureData(dataDirectory);
      const options = [
        "--data",
        dataDirectory,
        "--batch-size",
        "100",
        "--batch",
        "1",
        "--concurrency",
        "2",
        "--output",
        output,
      ] as const;
      const write = runCandidateDefinitions(options);
      expect(write.status).toBe(0);
      const generated = readFileSync(output, "utf8");
      expect(JSON.parse(generated)).toMatchObject({ schemaVersion: 1, candidates: expect.any(Array) });
      expect(runCandidateDefinitionsCheck(options).status).toBe(0);

      writeFileSync(output, "{}\n");
      const stale = runCandidateDefinitionsCheck(options);
      expect(stale.status).not.toBe(0);
      expect(stale.output).toContain("stale");
      expect(readFileSync(output, "utf8")).toBe("{}\n");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects authoritative output paths before writing", () => {
    const output = join(repositoryRoot, "data", "candidate-definition-batch.json");

    const outcome = runCandidateDefinitions(["--batch-size", "1", "--output", output]);

    expect(outcome.status).not.toBe(0);
    expect(outcome.output).toContain("refusing to write");
    expect(existsSync(output)).toBe(false);
    expect(isProtectedDefinitionOutputPath(output)).toBe(true);
  });
});
