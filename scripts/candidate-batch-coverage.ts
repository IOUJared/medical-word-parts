import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ZodError } from "zod";

import { DataError, DataValidationError, loadCorpus, validateCorpus } from "../src/data";
import {
  CandidateBatchCoverageError,
  checkCandidateBatchCoverage,
  type CandidateBatchCoverageWorkflow,
} from "../src/data/candidate-batch-coverage";
import { candidateTermsSha256 } from "../src/data/candidate-manifest";
import { createCandidateTriageReport } from "../src/data/candidate-triage";
import { defaultDataDirectory } from "../src/data/cli";
import { compareCodePoints } from "../src/data/ordering";

type CandidateBatchCoverageCommand = {
  readonly workflow: CandidateBatchCoverageWorkflow;
  readonly dataDirectory: string;
  readonly manifestPath: string;
  readonly batchesDirectory: string;
};

function workflowFromArgument(argument: string | undefined): CandidateBatchCoverageWorkflow {
  switch (argument) {
    case "definition":
      return "definition";
    case "decomposition":
      return "decomposition";
    default:
      throw new DataError("arguments", "use definition or decomposition followed by [--data <directory>] --manifest <path> --batches <directory>");
  }
}

function commandFromArguments(arguments_: readonly string[]): CandidateBatchCoverageCommand {
  const workflow = workflowFromArgument(arguments_[0]);
  let dataDirectory = defaultDataDirectory();
  let manifestPath: string | undefined;
  let batchesDirectory: string | undefined;
  const options = arguments_.slice(1);
  if (options.length % 2 !== 0) {
    throw new DataError("arguments", "use [--data <directory>] --manifest <path> --batches <directory>");
  }
  for (let index = 0; index < options.length; index += 2) {
    const option = options[index];
    const value = options[index + 1];
    if (value === undefined) throw new DataError("arguments", `${option ?? "option"} requires a value`);
    switch (option) {
      case "--data":
        dataDirectory = value;
        break;
      case "--manifest":
        manifestPath = value;
        break;
      case "--batches":
        batchesDirectory = value;
        break;
      default:
        throw new DataError("arguments", "use [--data <directory>] --manifest <path> --batches <directory>");
    }
  }
  if (manifestPath === undefined || batchesDirectory === undefined) {
    throw new DataError("arguments", "--manifest and --batches are required");
  }
  return { workflow, dataDirectory, manifestPath, batchesDirectory };
}

function excludedCandidateIds(command: CandidateBatchCoverageCommand): readonly string[] {
  const corpus = validateCorpus(loadCorpus(command.dataDirectory));
  const excluded = new Set(corpus.candidateReviewDecisions.map((decision) => decision.candidateId));
  if (command.workflow === "decomposition") {
    for (const category of createCandidateTriageReport(corpus).categories) {
      if (category.category === "verified_collision") {
        for (const candidate of category.candidates) excluded.add(candidate.id);
      }
    }
  }
  return [...excluded].sort(compareCodePoints);
}

function batchArtifacts(path: string) {
  return readdirSync(path)
    .filter((name) => name.endsWith(".json"))
    .sort(compareCodePoints)
    .map((name) => {
      const artifactPath = join(path, name);
      return { path: artifactPath, body: readFileSync(artifactPath, "utf8") };
    });
}

function coverageSummary(command: CandidateBatchCoverageCommand) {
  const candidateTermsPath = join(command.dataDirectory, "candidate-terms.json");
  return checkCandidateBatchCoverage({
    workflow: command.workflow,
    manifestJson: readFileSync(command.manifestPath, "utf8"),
    currentSourceSha256: candidateTermsSha256(readFileSync(candidateTermsPath)),
    excludedCandidateIds: excludedCandidateIds(command),
    artifacts: batchArtifacts(command.batchesDirectory),
  });
}

try {
  const command = commandFromArguments(process.argv.slice(2));
  console.log(JSON.stringify(coverageSummary(command)));
} catch (error) {
  if (error instanceof CandidateBatchCoverageError || error instanceof ZodError || error instanceof SyntaxError) {
    console.error(`candidate batch coverage: ${error.message}`);
    process.exitCode = 1;
  } else if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
