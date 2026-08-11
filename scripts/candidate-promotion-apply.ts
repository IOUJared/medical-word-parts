import { ZodError } from "zod";

import { DataError, DataValidationError } from "../src/data";
import {
  applyCandidatePromotions,
  candidatePromotionApplySummaryJson,
  CandidatePromotionApplyError,
  parseCandidatePromotionApplyOptions,
} from "../src/data/candidate-promotion-apply";
import { defaultDataDirectory } from "../src/data/cli";

function valueAfter(arguments_: readonly string[], option: string): string | undefined {
  const index = arguments_.indexOf(option);
  return index === -1 ? undefined : arguments_[index + 1];
}

function optionsFromArguments(arguments_: readonly string[]): unknown {
  if (arguments_.length % 2 !== 0) {
    throw new DataError("arguments", "use [--data <directory>] --manifest <path> --decomposition <path> --decomposition-sha256 <sha256>");
  }
  return {
    dataDirectory: valueAfter(arguments_, "--data") ?? defaultDataDirectory(),
    manifestPath: valueAfter(arguments_, "--manifest"),
    decompositionPath: valueAfter(arguments_, "--decomposition"),
    expectedDecompositionSha256: valueAfter(arguments_, "--decomposition-sha256"),
  };
}

try {
  const options = parseCandidatePromotionApplyOptions(optionsFromArguments(process.argv.slice(2)));
  console.log(candidatePromotionApplySummaryJson(applyCandidatePromotions(options)).trimEnd());
} catch (error) {
  if (error instanceof CandidatePromotionApplyError || error instanceof DataError || error instanceof DataValidationError || error instanceof ZodError) {
    console.error(`candidate promotion apply: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
