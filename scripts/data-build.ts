import { join } from "node:path";

import { dataCommandPathsFromArguments } from "../src/data/cli";
import { buildGeneratedCorpus } from "../src/data/generate";
import { DataError, DataValidationError, loadCorpus, validateCorpus } from "../src/data";

try {
  const paths = dataCommandPathsFromArguments(process.argv.slice(2));
  const corpus = validateCorpus(loadCorpus(paths.dataDirectory));
  buildGeneratedCorpus(corpus, paths.outputDirectory ?? join(process.cwd(), "src", "generated"));
  console.log("Generated deterministic corpus modules");
} catch (error) {
  if (error instanceof DataError || error instanceof DataValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
