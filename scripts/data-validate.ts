import { join } from "node:path";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { DataError, DataValidationError, loadCorpus, validateCorpus, verifyGeneratedOutput } from "../src/data";

try {
  const arguments_ = process.argv.slice(2);
  const paths = dataCommandPathsFromArguments(arguments_);
  const corpus = validateCorpus(loadCorpus(paths.dataDirectory));
  if (paths.outputDirectory !== undefined) {
    verifyGeneratedOutput(corpus, paths.outputDirectory);
  } else if (arguments_.length === 0) {
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
