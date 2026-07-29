import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { DataError, DataValidationError, loadCorpus, validateCorpus } from "../src/data";
import { candidatePromotionDraftJson, createCandidatePromotionDraft } from "../src/data/candidate-promotion-draft";
import { isProtectedTriageOutputPath } from "../src/data/candidate-triage";

type CandidatePromotionDraftCommand = {
  readonly dataDirectory: string;
  readonly outputDirectory: string;
  readonly candidateId: string;
  readonly force: boolean;
};

function candidatePromotionDraftCommandFromArguments(arguments_: readonly string[]): CandidatePromotionDraftCommand {
  const force = arguments_.includes("--force");
  const filtered = arguments_.filter((argument) => argument !== "--force");
  const candidateOption = filtered.indexOf("--candidate");
  if (candidateOption === -1 || filtered[candidateOption + 1] === undefined) {
    throw new DataError("arguments", "use --candidate <candidate:id> [--data <directory>] [--output <directory>] [--force]");
  }
  const candidateId = filtered[candidateOption + 1] ?? "";
  const dataArguments = filtered.filter((_, index) => index !== candidateOption && index !== candidateOption + 1);
  const paths = dataCommandPathsFromArguments(dataArguments);
  const outputDirectory = paths.outputDirectory ?? join(process.cwd(), ".artifacts", "candidate-term-drafts");
  if (isProtectedTriageOutputPath(outputDirectory)) {
    throw new DataError("arguments", `refusing to write candidate promotion draft under protected path ${outputDirectory}`);
  }
  return { dataDirectory: paths.dataDirectory, outputDirectory, candidateId, force };
}

try {
  const command = candidatePromotionDraftCommandFromArguments(process.argv.slice(2));
  const draft = createCandidatePromotionDraft(validateCorpus(loadCorpus(command.dataDirectory)), command.candidateId);
  const outputPath = join(command.outputDirectory, `${draft.slug}.json`);
  if (!command.force && existsSync(outputPath)) throw new DataError(outputPath, "candidate promotion draft already exists; pass --force to overwrite");
  mkdirSync(command.outputDirectory, { recursive: true });
  writeFileSync(outputPath, candidatePromotionDraftJson(draft));
  console.log(`Candidate promotion draft wrote ${outputPath}`);
} catch (error) {
  if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
