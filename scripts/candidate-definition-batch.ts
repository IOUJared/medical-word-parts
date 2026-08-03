import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ZodError } from "zod";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { DataError, DataValidationError, loadCorpus, validateCorpus } from "../src/data";
import {
  candidateDefinitionBatchJson,
  createCandidateDefinitionBatch,
  isProtectedDefinitionOutputPath,
} from "../src/data/candidate-definition-batch";
import { parseCandidateDefinitionBatchJson } from "../src/data/candidate-definition-batch-check";
import { createMeshDefinitionClient } from "../src/data/mesh-definition-client";

type CandidateDefinitionBatchCommand = {
  readonly dataDirectory: string;
  readonly outputPath: string;
  readonly check: boolean;
  readonly limit?: number;
  readonly batchSize?: number;
  readonly batchNumber?: number;
  readonly concurrency?: number;
};

function positiveIntegerFromValue(name: string, value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new DataError("arguments", `${name} must be a positive integer`);
  return parsed;
}

function optionValue(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  return index === -1 ? undefined : arguments_[index + 1];
}

function withoutValueOption(arguments_: readonly string[], option: string): readonly string[] {
  const index = arguments_.indexOf(option);
  return index === -1 ? arguments_ : arguments_.filter((_, current) => current !== index && current !== index + 1);
}

function commandFromArguments(arguments_: readonly string[]): CandidateDefinitionBatchCommand {
  const check = arguments_.includes("--check");
  const checkFiltered = arguments_.filter((argument) => argument !== "--check");
  const limitValue = optionValue(checkFiltered, "--limit");
  const batchSizeValue = optionValue(checkFiltered, "--batch-size");
  const batchValue = optionValue(checkFiltered, "--batch");
  const concurrencyValue = optionValue(checkFiltered, "--concurrency");
  const limit = limitValue === undefined ? undefined : positiveIntegerFromValue("--limit", limitValue);
  const batchSize = batchSizeValue === undefined ? undefined : positiveIntegerFromValue("--batch-size", batchSizeValue);
  const batchNumber = batchValue === undefined ? undefined : positiveIntegerFromValue("--batch", batchValue);
  const concurrency = concurrencyValue === undefined
    ? undefined
    : positiveIntegerFromValue("--concurrency", concurrencyValue);
  const dataArguments = withoutValueOption(
    withoutValueOption(withoutValueOption(withoutValueOption(checkFiltered, "--limit"), "--batch-size"), "--batch"),
    "--concurrency",
  );
  const paths = dataCommandPathsFromArguments(dataArguments);
  const outputPath = paths.outputDirectory ?? join(process.cwd(), ".artifacts", "candidate-definition-batch.json");
  if (isProtectedDefinitionOutputPath(outputPath)) {
    throw new DataError("arguments", `refusing to write candidate definition batch under protected path ${outputPath}`);
  }
  return {
    dataDirectory: paths.dataDirectory,
    outputPath,
    check,
    ...(limit === undefined ? {} : { limit }),
    ...(batchSize === undefined ? {} : { batchSize }),
    ...(batchNumber === undefined ? {} : { batchNumber }),
    ...(concurrency === undefined ? {} : { concurrency }),
  };
}

function readExisting(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function expectedIncludedCount(command: CandidateDefinitionBatchCommand, corpus: ReturnType<typeof validateCorpus>): number {
  const pendingCount = corpus.candidateTerms.length - corpus.candidateReviewDecisions.length;
  const batchSize = command.batchSize ?? command.limit ?? pendingCount;
  const batchNumber = command.batchNumber ?? 1;
  return Math.max(Math.min(pendingCount - ((batchNumber - 1) * batchSize), batchSize), 0);
}

function checkExisting(command: CandidateDefinitionBatchCommand, corpus: ReturnType<typeof validateCorpus>): void {
  const existing = readExisting(command.outputPath);
  if (existing === undefined) {
    throw new DataError(command.outputPath, "candidate definition batch is missing; run npm run candidate:definitions");
  }
  let batch: ReturnType<typeof parseCandidateDefinitionBatchJson>;
  try {
    batch = parseCandidateDefinitionBatchJson(existing);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      throw new DataError(command.outputPath, "candidate definition batch is stale; run npm run candidate:definitions");
    }
    throw error;
  }
  const expectedIncluded = expectedIncludedCount(command, corpus);
  if (
    batch.summary.candidateTermCount !== corpus.candidateTerms.length
    || batch.summary.deferredCandidateCount !== corpus.candidateReviewDecisions.length
    || batch.summary.includedCandidateCount !== expectedIncluded
    || (command.batchSize !== undefined && batch.summary.batchSize !== command.batchSize)
    || (command.batchNumber !== undefined && batch.summary.batchNumber !== command.batchNumber)
  ) {
    throw new DataError(command.outputPath, "candidate definition batch is stale; run npm run candidate:definitions");
  }
  if (batch.summary.failedDefinitionCount > 0) {
    throw new DataError(command.outputPath, "candidate definition batch contains failed definition fetches");
  }
}

try {
  const command = commandFromArguments(process.argv.slice(2));
  const corpus = validateCorpus(loadCorpus(command.dataDirectory));
  if (command.check) {
    checkExisting(command, corpus);
  } else {
    const batch = await createCandidateDefinitionBatch(corpus, createMeshDefinitionClient(), {
      ...(command.limit === undefined ? {} : { limit: command.limit }),
      ...(command.batchSize === undefined ? {} : { batchSize: command.batchSize }),
      ...(command.batchNumber === undefined ? {} : { batchNumber: command.batchNumber }),
      ...(command.concurrency === undefined ? {} : { concurrency: command.concurrency }),
    });
    mkdirSync(dirname(command.outputPath), { recursive: true });
    writeFileSync(command.outputPath, candidateDefinitionBatchJson(batch));
  }
  console.log(`Candidate definition batch ${command.check ? "checked" : "wrote"} ${command.outputPath}`);
} catch (error) {
  if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
