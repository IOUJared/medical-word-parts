import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ZodError } from "zod";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { DataError, DataValidationError, loadCorpus, validateCorpus } from "../src/data";
import {
  candidateManifestJson,
  candidateTermsSha256,
  createCandidateManifest,
  assertSafeCandidateArtifactOutputPath,
  parseCandidateManifestJson,
  writeCandidateArtifactFile,
} from "../src/data/candidate-manifest";

type CandidateManifestCommand = {
  readonly check: boolean;
  readonly dataDirectory: string;
  readonly outputPath: string;
};

function commandFromArguments(arguments_: readonly string[]): CandidateManifestCommand {
  const check = arguments_.includes("--check");
  const paths = dataCommandPathsFromArguments(arguments_.filter((argument) => argument !== "--check"));
  const outputPath = paths.outputDirectory ?? join(process.cwd(), ".artifacts", "candidate-manifest.json");
  return { check, dataDirectory: paths.dataDirectory, outputPath: assertSafeCandidateArtifactOutputPath(outputPath) };
}

function currentManifest(dataDirectory: string) {
  const candidateTermsPath = join(dataDirectory, "candidate-terms.json");
  const bytes = readFileSync(candidateTermsPath);
  const corpus = validateCorpus(loadCorpus(dataDirectory));
  return createCandidateManifest(
    corpus.candidateTerms.map((candidate) => ({ id: candidate.id, normalized: candidate.normalized })),
    candidateTermsSha256(bytes),
  );
}

function checkExisting(command: CandidateManifestCommand): void {
  let existing;
  try {
    existing = readFileSync(command.outputPath, "utf8");
    parseCandidateManifestJson(existing);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError || (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
      throw new DataError(command.outputPath, "candidate manifest is stale; run npm run candidate:manifest");
    }
    throw error;
  }
  if (existing !== candidateManifestJson(currentManifest(command.dataDirectory))) {
    throw new DataError(command.outputPath, "candidate manifest is stale; run npm run candidate:manifest");
  }
}

try {
  const command = commandFromArguments(process.argv.slice(2));
  if (command.check) {
    checkExisting(command);
  } else {
    writeCandidateArtifactFile(command.outputPath, candidateManifestJson(currentManifest(command.dataDirectory)));
  }
  console.log(`Candidate manifest ${command.check ? "checked" : "wrote"} ${command.outputPath}`);
} catch (error) {
  if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
