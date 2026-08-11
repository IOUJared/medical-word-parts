import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { isProtectedDecompositionOutputPath } from "../../src/data/candidate-decomposition-batch";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runCandidateDecompose(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "candidate:decompose", "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function runCandidateDecomposeCheck(arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "candidate:decompose:check", "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFixtureData(directory: string, candidateTerms: readonly unknown[] = [
  {
    id: "candidate:pre-root-missing",
    term: "prerootmissing",
    normalized: "prerootmissing",
    status: "candidate",
    sources: ["source:test"],
    sourceVersion: "fixture",
    license: "fixture license",
  },
]): void {
  mkdirSync(join(directory, "terms"), { recursive: true });
  mkdirSync(join(directory, "word-parts"), { recursive: true });
  writeJson(join(directory, "sources.json"), {
    sources: [{ id: "source:test", publisher: "Test", title: "Test Source", url: "https://example.test/source" }],
  });
  writeJson(join(directory, "aliases.json"), { aliases: [] });
  writeJson(join(directory, "relations.json"), { relations: [] });
  writeJson(join(directory, "candidate-terms.json"), {
    candidateTerms,
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

describe("candidate decomposition batch CLI", () => {
  it("writes and checks a deterministic 100-candidate decomposition artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-decompose-"));
    const output = join(directory, "candidate-decomposition-batch.json");
    try {
      const dataDirectory = join(directory, "data");
      writeFixtureData(dataDirectory);
      const options = ["--data", dataDirectory, "--batch-size", "100", "--batch", "1", "--output", output] as const;
      const write = runCandidateDecompose(options);
      expect(write.status).toBe(0);
      const generated = readFileSync(output, "utf8");
      expect(JSON.parse(generated)).toMatchObject({ schemaVersion: 1, candidates: expect.any(Array) });
      expect(runCandidateDecomposeCheck(options).status).toBe(0);

      writeFileSync(output, "{}\n");
      const stale = runCandidateDecomposeCheck(options);
      expect(stale.status).not.toBe(0);
      expect(stale.output).toContain("stale");
      expect(readFileSync(output, "utf8")).toBe("{}\n");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects authoritative output paths before writing", () => {
    const output = join(repositoryRoot, "data", "candidate-decomposition-batch.json");

    const outcome = runCandidateDecompose(["--batch-size", "1", "--output", output]);

    expect(outcome.status).not.toBe(0);
    expect(outcome.output).toContain("refusing to write");
    expect(existsSync(output)).toBe(false);
    expect(isProtectedDecompositionOutputPath(output)).toBe(true);
  });

  it("rejects malformed positive integer batch options", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-decompose-arguments-"));
    const output = join(directory, "candidate-decomposition-batch.json");
    try {
      const malformedBatchSize = runCandidateDecompose(["--batch-size", "100junk", "--output", output]);
      const malformedBatchNumber = runCandidateDecompose(["--batch", "1junk", "--output", output]);
      const zeroBatchSize = runCandidateDecompose(["--batch-size", "0", "--output", output]);
      const zeroBatchSizeCheck = runCandidateDecomposeCheck(["--batch-size", "0", "--output", output]);

      expect(malformedBatchSize.status).not.toBe(0);
      expect(malformedBatchSize.output).toContain("positive integer");
      expect(malformedBatchNumber.status).not.toBe(0);
      expect(malformedBatchNumber.output).toContain("positive integer");
      expect(zeroBatchSize.status).not.toBe(0);
      expect(zeroBatchSize.output).toContain("positive integer");
      expect(zeroBatchSizeCheck.status).not.toBe(0);
      expect(zeroBatchSizeCheck.output).toContain("positive integer");
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects decomposition batch sizes above the frozen 100-candidate limit before writing or checking", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-decompose-oversized-"));
    const output = join(directory, "candidate-decomposition-batch.json");
    try {
      const write = runCandidateDecompose(["--batch-size", "101", "--output", output]);
      const check = runCandidateDecomposeCheck(["--batch-size", "101", "--output", output]);

      expect(write.status).not.toBe(0);
      expect(write.output).toContain("at most 100");
      expect(check.status).not.toBe(0);
      expect(check.output).toContain("at most 100");
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a non-empty batch number beyond its final source window before writing or checking", () => {
    // Given: 1,001 source candidates, which occupy eleven frozen 100-candidate windows.
    const directory = mkdtempSync(join(tmpdir(), "candidate-decompose-out-of-range-"));
    const output = join(directory, "candidate-decomposition-batch.json");
    try {
      const dataDirectory = join(directory, "data");
      const candidates = Array.from({ length: 1001 }, (_, index) => ({
        id: `candidate:word-${String(index + 1).padStart(4, "0")}`,
        term: `word${index + 1}`,
        normalized: `word${index + 1}`,
        status: "candidate",
        sources: ["source:test"],
        sourceVersion: "fixture",
        license: "fixture license",
      }));
      writeFixtureData(dataDirectory, candidates);
      const options = ["--data", dataDirectory, "--batch", "12", "--output", output] as const;

      // When: producer and checker receive the first out-of-range batch number.
      const write = runCandidateDecompose(options);
      const check = runCandidateDecomposeCheck(options);

      // Then: both reject before a semantically empty artifact can exist.
      expect(write.status).not.toBe(0);
      expect(write.output).toContain("batch number 12 exceeds source batch count 11");
      expect(check.status).not.toBe(0);
      expect(check.output).toContain("batch number 12 exceeds source batch count 11");
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("writes a default empty-candidate batch that its default checker accepts", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-decompose-zero-"));
    const output = join(directory, "candidate-decomposition-batch.json");
    try {
      const dataDirectory = join(directory, "data");
      writeFixtureData(dataDirectory, []);
      const options = ["--data", dataDirectory, "--output", output] as const;

      const write = runCandidateDecompose(options);

      expect(write.status).toBe(0);
      expect(JSON.parse(readFileSync(output, "utf8")).summary).toMatchObject({
        candidateTermCount: 0,
        includedCandidateCount: 0,
        batchSize: 100,
        batchNumber: 1,
      });
      expect(runCandidateDecomposeCheck(options).status).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
