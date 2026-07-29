import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const canonicalArtifacts = [
  "src/generated/candidates.ts",
  "src/generated/corpus.ts",
  "src/generated/index.ts",
  "src/generated/routes.ts",
  "src/generated/segmentation.ts",
  "public/generated/analyzer.js",
  "public/generated/parts.js",
  "public/generated/site.js",
] as const;

type SuiteOutcome = {
  readonly status: number | null;
  readonly output: string;
};

function artifactDigests(): readonly string[] {
  return canonicalArtifacts.map((path) => createHash("sha256").update(readFileSync(join(repositoryRoot, path))).digest("hex"));
}

function runSuite(path: string): Promise<SuiteOutcome> {
  return new Promise((resolve) => {
    const child = spawn(npmCommand, ["test", "--", "--run", path], { cwd: repositoryRoot });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.on("close", (status) => resolve({ status, output }));
  });
}

describe("canonical artifact isolation", () => {
  it("Given generation and importing suites, when they run in parallel, then canonical artifacts remain unchanged", async () => {
    const initialDigests = artifactDigests();

    const outcomes = await Promise.all([
      runSuite("tests/data/build.test.ts"),
      runSuite("tests/ui/static-params.test.ts"),
      runSuite("tests/infrastructure/analyzer-bundle.test.ts"),
    ]);

    expect(outcomes.map((outcome) => outcome.status), outcomes.map((outcome) => outcome.output).join("\n")).toEqual([0, 0, 0]);
    expect(artifactDigests()).toEqual(initialDigests);
  }, 30_000);
});
