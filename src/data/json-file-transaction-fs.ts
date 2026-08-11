import { closeSync, constants, fsyncSync, lstatSync, openSync, realpathSync, writeFileSync } from "node:fs";
import { relative, sep } from "node:path";

export class JsonFileTransactionError extends Error {
  override readonly name = "JsonFileTransactionError";

  constructor(readonly detail: string, options?: ErrorOptions) {
    super(detail, options);
  }
}

export function isFileSystemError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export function assertNotSymbolicLink(path: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      throw new JsonFileTransactionError(`transaction path contains a symbolic link: ${path}`);
    }
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) return;
    throw error;
  }
}

export function isWithin(parent: string, child: string): boolean {
  const childRelativePath = relative(parent, child);
  return childRelativePath.length === 0
    || (!childRelativePath.startsWith("..") && !childRelativePath.startsWith(sep));
}

export function anchoredDirectoryPath(descriptor: number, fallback: string): string {
  if (process.platform !== "linux") return fallback;
  const descriptorPath = `/proc/self/fd/${descriptor}`;
  realpathSync(descriptorPath);
  return descriptorPath;
}

export function durableWrite(path: string, content: string, exclusive = false): void {
  const flags = constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW
    | (exclusive ? constants.O_EXCL : constants.O_TRUNC);
  const descriptor = openSync(path, flags, 0o600);
  try {
    writeFileSync(descriptor, content, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function syncJsonTransactionDirectory(path: string, platform: NodeJS.Platform = process.platform): void {
  if (platform === "win32") return;
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
