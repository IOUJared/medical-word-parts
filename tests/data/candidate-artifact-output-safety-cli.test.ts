import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { writeCandidateArtifactFile } from "../../src/data/candidate-manifest";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const candidateArtifactWriters = [
  { name: "candidate manifest", script: "candidate:manifest", arguments_: [] },
  { name: "candidate decomposition batch", script: "candidate:decompose", arguments_: ["--batch-size", "1"] },
  { name: "candidate definition batch", script: "candidate:definitions", arguments_: ["--batch-size", "1"] },
] as const;

function contentHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runWriter(script: string, arguments_: readonly string[]): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", script, "--", ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function protectedTargetPath(directory: string): string {
  return join(repositoryRoot, "data", `.candidate-artifact-safety-${basename(directory)}.json`);
}

describe("candidate artifact output safety", () => {
  for (const writer of candidateArtifactWriters) {
    it(`rejects a symlink file output before ${writer.name} changes its protected target`, () => {
      const directory = mkdtempSync(join(tmpdir(), "candidate-artifact-file-link-"));
      const target = protectedTargetPath(directory);
      const output = join(directory, "output.json");
      try {
        writeFileSync(target, "protected target before\n");
        symlinkSync(target, output);
        const before = contentHash(target);

        const outcome = runWriter(writer.script, [...writer.arguments_, "--output", output]);

        expect(outcome.status).not.toBe(0);
        expect(outcome.output).toContain("refusing to write");
        expect(contentHash(target)).toBe(before);
        expect(lstatSync(output).isSymbolicLink()).toBe(true);
      } finally {
        rmSync(directory, { recursive: true, force: true });
        if (existsSync(target)) rmSync(target);
      }
    });

    it(`rejects a symlink ancestor output before ${writer.name} changes its protected target`, () => {
      const directory = mkdtempSync(join(tmpdir(), "candidate-artifact-ancestor-link-"));
      const target = protectedTargetPath(directory);
      const symlinkAncestor = join(directory, "output-parent");
      const output = join(symlinkAncestor, basename(target));
      try {
        writeFileSync(target, "protected target before\n");
        symlinkSync(join(repositoryRoot, "data"), symlinkAncestor);
        const before = contentHash(target);

        const outcome = runWriter(writer.script, [...writer.arguments_, "--output", output]);

        expect(outcome.status).not.toBe(0);
        expect(outcome.output).toContain("refusing to write");
        expect(contentHash(target)).toBe(before);
        expect(lstatSync(symlinkAncestor).isSymbolicLink()).toBe(true);
      } finally {
        rmSync(directory, { recursive: true, force: true });
        if (existsSync(target)) rmSync(target);
      }
    });
  }

  it.skipIf(process.platform !== "linux")("anchors the mutation to the verified parent during an ancestor swap", () => {
    const directory = mkdtempSync(join(tmpdir(), "candidate-artifact-race-"));
    const protectedDirectory = mkdtempSync(join(tmpdir(), "candidate-artifact-protected-"));
    const originalParent = join(directory, "output-parent");
    const movedParent = join(directory, "verified-parent");
    const output = join(originalParent, "victim.json");
    const protectedTarget = join(protectedDirectory, "victim.json");
    try {
      mkdirSync(originalParent);
      writeFileSync(protectedTarget, "PROTECTED\n");
      const before = contentHash(protectedTarget);

      writeCandidateArtifactFile(output, "SAFE OUTPUT\n", { beforeRename() {
        renameSync(originalParent, movedParent);
        symlinkSync(protectedDirectory, originalParent);
      } });

      expect(contentHash(protectedTarget)).toBe(before);
      expect(readFileSync(join(movedParent, "victim.json"), "utf8")).toBe("SAFE OUTPUT\n");
      expect(lstatSync(originalParent).isSymbolicLink()).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      rmSync(protectedDirectory, { recursive: true, force: true });
    }
  });
});
