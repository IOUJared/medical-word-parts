import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { DataError, DataValidationError, loadCorpus, validateCorpus } from "../src/data";
import {
  candidateTriageReportJson,
  createCandidateTriageReport,
  isProtectedTriageOutputPath,
} from "../src/data/candidate-triage";

type TriageCommandPaths = {
  readonly dataDirectory: string;
  readonly outputPath: string;
  readonly check: boolean;
};

function triageCommandPathsFromArguments(arguments_: readonly string[]): TriageCommandPaths {
  const check = arguments_.includes("--check");
  const filtered = arguments_.filter((argument) => argument !== "--check");
  const paths = dataCommandPathsFromArguments(filtered);
  const outputPath = paths.outputDirectory ?? join(process.cwd(), ".artifacts", "candidate-verification-triage.json");
  if (isProtectedTriageOutputPath(outputPath)) {
    throw new DataError("arguments", `refusing to write candidate triage report under protected path ${outputPath}`);
  }
  return { dataDirectory: paths.dataDirectory, outputPath, check };
}

function readExisting(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

try {
  const paths = triageCommandPathsFromArguments(process.argv.slice(2));
  const report = createCandidateTriageReport(validateCorpus(loadCorpus(paths.dataDirectory)));
  const body = candidateTriageReportJson(report);
  if (paths.check) {
    if (readExisting(paths.outputPath) !== body) {
      throw new DataError(paths.outputPath, "candidate verification triage report is stale; run npm run candidate:triage");
    }
  } else {
    mkdirSync(dirname(paths.outputPath), { recursive: true });
    writeFileSync(paths.outputPath, body);
  }
  console.log(`Candidate verification triage report ${paths.check ? "checked" : "wrote"} ${paths.outputPath}`);
} catch (error) {
  if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
