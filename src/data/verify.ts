import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { DataValidationError } from "./errors";
import { renderGeneratedCorpus } from "./generate";
import { compareCodePoints } from "./ordering";
import type { Corpus } from "./validate";

export function verifyGeneratedOutput(corpus: Corpus, destination: string): void {
  const errors: string[] = [];
  const outputs = renderGeneratedCorpus(corpus);
  const expectedNames = new Set(outputs.map((output) => output.filename));
  for (const output of outputs) {
    const path = join(destination, output.filename);
    if (!existsSync(path) || readFileSync(path, "utf8") !== output.contents) {
      errors.push(`src/generated/${output.filename}: generated output is stale or missing; run npm run data:build`);
    }
  }
  if (existsSync(destination)) {
    for (const filename of readdirSync(destination).sort(compareCodePoints)) {
      if (!expectedNames.has(filename)) {
        errors.push(`src/generated/${filename}: obsolete generated output; run npm run data:build`);
      }
    }
  }
  if (errors.length > 0) {
    throw new DataValidationError(errors);
  }
}
