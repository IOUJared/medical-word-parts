import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z, ZodError } from "zod";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { DataError, DataValidationError, loadCorpus, validateCorpus } from "../src/data";
import {
  candidateDecompositionBatchJson,
  createCandidateDecompositionBatch,
} from "../src/data/candidate-decomposition-batch";
import { parseCandidateDecompositionBatchJson } from "../src/data/candidate-decomposition-batch-check";
import { assertSafeCandidateArtifactOutputPath, candidateManifestWindowSize, writeCandidateArtifactFile } from "../src/data/candidate-manifest";

type CandidateDecompositionBatchCommand = {
  readonly dataDirectory: string;
  readonly outputPath: string;
  readonly check: boolean;
  readonly batchSize?: number;
  readonly batchNumber?: number;
};

const positiveIntegerSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .refine(Number.isSafeInteger);

function positiveIntegerFromValue(name: string, value: string): number {
  const parsed = positiveIntegerSchema.safeParse(value);
  if (!parsed.success) throw new DataError("arguments", `${name} must be a positive integer`);
  return parsed.data;
}

function batchSizeFromValue(value: string): number {
  const batchSize = positiveIntegerFromValue("--batch-size", value);
  if (batchSize > candidateManifestWindowSize) {
    throw new DataError("arguments", `--batch-size must be at most ${candidateManifestWindowSize}`);
  }
  return batchSize;
}

function optionValue(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  if (index === -1) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new DataError("arguments", `${option} requires a value`);
  }
  return value;
}

function withoutValueOption(arguments_: readonly string[], option: string): readonly string[] {
  const index = arguments_.indexOf(option);
  return index === -1 ? arguments_ : arguments_.filter((_, current) => current !== index && current !== index + 1);
}

function commandFromArguments(arguments_: readonly string[]): CandidateDecompositionBatchCommand {
  const check = arguments_.includes("--check");
  const checkFiltered = arguments_.filter((argument) => argument !== "--check");
  const batchSizeValue = optionValue(checkFiltered, "--batch-size");
  const batchValue = optionValue(checkFiltered, "--batch");
  const batchSize = batchSizeValue === undefined ? undefined : batchSizeFromValue(batchSizeValue);
  const batchNumber = batchValue === undefined ? undefined : positiveIntegerFromValue("--batch", batchValue);
  const dataArguments = withoutValueOption(withoutValueOption(checkFiltered, "--batch-size"), "--batch");
  const paths = dataCommandPathsFromArguments(dataArguments);
  const outputPath = paths.outputDirectory ?? join(process.cwd(), ".artifacts", "candidate-decomposition-batch.json");
  return {
    dataDirectory: paths.dataDirectory,
    outputPath: assertSafeCandidateArtifactOutputPath(outputPath),
    check,
    ...(batchSize === undefined ? {} : { batchSize }),
    ...(batchNumber === undefined ? {} : { batchNumber }),
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

function checkExisting(command: CandidateDecompositionBatchCommand): void {
  const corpus = validateCorpus(loadCorpus(command.dataDirectory));
  const expected = createCandidateDecompositionBatch(corpus, {
    ...(command.batchSize === undefined ? {} : { batchSize: command.batchSize }),
    ...(command.batchNumber === undefined ? {} : { batchNumber: command.batchNumber }),
  });
  const existing = readExisting(command.outputPath);
  if (existing === undefined) {
    throw new DataError(command.outputPath, "candidate decomposition batch is missing; run npm run candidate:decompose");
  }
  try {
    parseCandidateDecompositionBatchJson(existing);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      throw new DataError(command.outputPath, "candidate decomposition batch is stale; run npm run candidate:decompose");
    }
    throw error;
  }
  if (existing !== candidateDecompositionBatchJson(expected)) {
    throw new DataError(command.outputPath, "candidate decomposition batch is stale; run npm run candidate:decompose");
  }
}

try {
  const command = commandFromArguments(process.argv.slice(2));
  if (command.check) {
    checkExisting(command);
  } else {
    const corpus = validateCorpus(loadCorpus(command.dataDirectory));
    const batch = createCandidateDecompositionBatch(corpus, {
      ...(command.batchSize === undefined ? {} : { batchSize: command.batchSize }),
      ...(command.batchNumber === undefined ? {} : { batchNumber: command.batchNumber }),
    });
    writeCandidateArtifactFile(command.outputPath, candidateDecompositionBatchJson(batch));
  }
  console.log(`Candidate decomposition batch ${command.check ? "checked" : "wrote"} ${command.outputPath}`);
} catch (error) {
  if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
