import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ZodError } from "zod";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { DataError, DataValidationError, loadCorpus, validateCorpus, verifyGeneratedOutput } from "../src/data";
import { candidateTermsSha256 } from "../src/data/candidate-manifest";
import {
  CandidateDispositionArchiveError,
  checkCandidateDispositionArchive,
} from "../src/data/validate-candidate-dispositions";

type DataValidationCommand = {
  readonly dataArguments: readonly string[];
  readonly candidateDispositionManifestPath?: string;
};

function commandFromArguments(arguments_: readonly string[]): DataValidationCommand {
  const option = "--candidate-disposition-manifest";
  const optionIndex = arguments_.indexOf(option);
  if (optionIndex === -1) return { dataArguments: arguments_ };
  if (arguments_.indexOf(option, optionIndex + 1) !== -1) {
    throw new DataError("arguments", `${option} may be provided only once`);
  }
  const candidateDispositionManifestPath = arguments_[optionIndex + 1];
  if (candidateDispositionManifestPath === undefined || candidateDispositionManifestPath.startsWith("--")) {
    throw new DataError("arguments", `${option} requires a file path`);
  }
  return {
    dataArguments: arguments_.filter((_, index) => index !== optionIndex && index !== optionIndex + 1),
    candidateDispositionManifestPath,
  };
}

function checkCandidateDispositionArchiveForData(
  candidateDispositionManifestPath: string,
  dataDirectory: string,
  activeCandidates: readonly { readonly id: string; readonly normalized: string }[],
  candidateDispositions: readonly {
    readonly originalCandidateId: string;
    readonly originalNormalized: string;
  }[],
): void {
  const candidateTermsPath = join(dataDirectory, "candidate-terms.json");
  try {
    checkCandidateDispositionArchive({
      manifestJson: readFileSync(candidateDispositionManifestPath, "utf8"),
      currentSourceSha256: candidateTermsSha256(readFileSync(candidateTermsPath)),
      activeCandidates: activeCandidates.map((candidate) => ({
        id: candidate.id,
        normalized: candidate.normalized,
      })),
      dispositions: candidateDispositions,
    });
  } catch (error) {
    if (error instanceof CandidateDispositionArchiveError) {
      throw new DataError(candidateDispositionManifestPath, error.detail);
    }
    if (error instanceof SyntaxError || error instanceof ZodError) {
      throw new DataError(candidateDispositionManifestPath, "invalid candidate disposition manifest");
    }
    throw error;
  }
}

try {
  const command = commandFromArguments(process.argv.slice(2));
  const paths = dataCommandPathsFromArguments(command.dataArguments);
  const corpus = validateCorpus(loadCorpus(paths.dataDirectory));
  if (command.candidateDispositionManifestPath !== undefined) {
    checkCandidateDispositionArchiveForData(
      command.candidateDispositionManifestPath,
      paths.dataDirectory,
      corpus.candidateTerms,
      corpus.candidateDispositions,
    );
  }
  if (paths.outputDirectory !== undefined) {
    verifyGeneratedOutput(corpus, paths.outputDirectory);
  } else if (command.dataArguments.length === 0) {
    verifyGeneratedOutput(corpus, join(process.cwd(), "src", "generated"));
  }
  console.log(`Validated ${paths.dataDirectory}`);
} catch (error) {
  if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
