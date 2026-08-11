import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  candidateManifestJson,
  candidateTermsSha256,
  createCandidateManifest,
} from "../../src/data/candidate-manifest";
import { candidateDispositionsDocumentSchema } from "../../src/data/schemas";
import { createFixture, removeFixture } from "./fixture";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export const deferredDisposition = {
  originalCandidateId: "candidate:diabetes",
  originalTerm: "diabetes",
  originalNormalized: "diabetes",
  outcome: "deferred_insufficient_evidence",
  reviewSources: ["source:test"],
  note: "The reviewed source does not document a complete word-part analysis.",
} as const;

export function archivedCandidateManifest(): {
  readonly manifestJson: string;
  readonly sourceSha256: string;
  readonly firstDisposition: {
    readonly originalCandidateId: string;
    readonly originalNormalized: string;
  };
} {
  const candidateTermsPath = join(repositoryRoot, "data", "candidate-terms.json");
  const bytes = readFileSync(candidateTermsPath);
  const dispositions = candidateDispositionsDocumentSchema.parse(
    JSON.parse(readFileSync(join(repositoryRoot, "data", "candidate-dispositions.json"), "utf8")),
  ).candidateDispositions;
  const firstDisposition = dispositions[0];
  if (firstDisposition === undefined) throw new Error("production disposition archive is empty");
  const sourceSha256 = candidateTermsSha256(bytes);
  return {
    manifestJson: candidateManifestJson(createCandidateManifest(
      dispositions.map((disposition) => ({
        id: disposition.originalCandidateId,
        normalized: disposition.originalNormalized,
      })),
      sourceSha256,
    )),
    sourceSha256,
    firstDisposition,
  };
}

export function writeDispositions(directory: string, candidateDispositions: readonly object[]): void {
  writeFileSync(
    join(directory, "candidate-dispositions.json"),
    `${JSON.stringify({ candidateDispositions }, null, 2)}\n`,
  );
}

export function validate(directory: string): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "data:validate", "--", "--data", directory], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

export function validateArchive(
  directory: string,
  manifestPath: string,
): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, [
    "run",
    "data:validate",
    "--",
    "--data",
    directory,
    "--candidate-disposition-manifest",
    manifestPath,
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

export function writeManifest(
  directory: string,
  sourceSha256: string,
  candidates: readonly { readonly id: string; readonly normalized: string }[],
): string {
  const manifestPath = join(directory, "candidate-manifest.json");
  writeFileSync(
    manifestPath,
    candidateManifestJson(createCandidateManifest(candidates, sourceSha256)),
  );
  return manifestPath;
}

export function fixtureCandidateSourceSha256(directory: string): string {
  return candidateTermsSha256(readFileSync(join(directory, "candidate-terms.json")));
}

export function withFixture(run: (directory: string) => void): void {
  const directory = createFixture();
  try {
    run(directory);
  } finally {
    removeFixture(directory);
  }
}
