import { fileURLToPath } from "node:url";

import { DataError } from "./errors";

export function defaultDataDirectory(): string {
  return fileURLToPath(new URL("../../data", import.meta.url));
}

export type DataCommandPaths = {
  readonly dataDirectory: string;
  readonly outputDirectory?: string;
};

export function dataCommandPathsFromArguments(arguments_: readonly string[]): DataCommandPaths {
  let dataDirectory = defaultDataDirectory();
  let outputDirectory: string | undefined;
  if (arguments_.length % 2 !== 0) {
    throw new DataError("arguments", "use [--data <directory>] [--output <directory>] or no arguments");
  }
  for (let index = 0; index < arguments_.length; index += 2) {
    const option = arguments_[index];
    const directory = arguments_[index + 1];
    if (directory === undefined) {
      throw new DataError("arguments", "each option requires a directory");
    }
    switch (option) {
      case "--data":
        dataDirectory = directory;
        break;
      case "--output":
        outputDirectory = directory;
        break;
      default:
        throw new DataError("arguments", "use [--data <directory>] [--output <directory>] or no arguments");
    }
  }
  return outputDirectory === undefined ? { dataDirectory } : { dataDirectory, outputDirectory };
}
