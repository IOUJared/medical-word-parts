import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

import { z } from "zod";

import { compareCodePoints } from "./ordering";
import { DataError } from "./errors";

export const candidateManifestWindowSize = 100;

const candidateManifestEntrySchema = z.strictObject({
  id: z.string().regex(/^candidate:[a-z0-9-]+$/),
  normalized: z.string().regex(/^[a-z0-9]+(?:[ -][a-z0-9]+)*$/),
});

const candidateManifestWindowSchema = z.strictObject({
  batchNumber: z.number().int().positive(),
  candidateIds: z.array(z.string().regex(/^candidate:[a-z0-9-]+$/)).min(1).max(candidateManifestWindowSize),
});

const candidateManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  source: z.strictObject({
    candidateTermsSha256: z.string().regex(/^[a-f0-9]{64}$/),
    candidateCount: z.number().int().nonnegative(),
  }),
  summary: z.strictObject({
    candidateCount: z.number().int().nonnegative(),
    windowCount: z.number().int().nonnegative(),
    maxWindowSize: z.literal(candidateManifestWindowSize),
  }),
  candidates: z.array(candidateManifestEntrySchema),
  windows: z.array(candidateManifestWindowSchema),
}).superRefine((manifest, context) => {
  if (manifest.source.candidateCount !== manifest.candidates.length || manifest.summary.candidateCount !== manifest.candidates.length) {
    context.addIssue({ code: "custom", path: ["summary", "candidateCount"], message: "candidate counts must match entries" });
  }
  if (manifest.summary.windowCount !== manifest.windows.length) {
    context.addIssue({ code: "custom", path: ["summary", "windowCount"], message: "window count must match windows" });
  }
  for (const [index, candidate] of manifest.candidates.entries()) {
    const previous = manifest.candidates[index - 1];
    if (previous !== undefined && (compareCodePoints(previous.normalized, candidate.normalized) > 0
      || (previous.normalized === candidate.normalized && compareCodePoints(previous.id, candidate.id) > 0))) {
      context.addIssue({ code: "custom", path: ["candidates", index], message: "candidates must be source ordered by normalized then ID" });
    }
  }
  const candidateIds = manifest.candidates.map((candidate) => candidate.id);
  if (new Set(candidateIds).size !== candidateIds.length) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "candidate IDs must be unique" });
  }
  const windowIds = manifest.windows.flatMap((window) => window.candidateIds);
  for (const [index, window] of manifest.windows.entries()) {
    if (window.batchNumber !== index + 1) {
      context.addIssue({ code: "custom", path: ["windows", index, "batchNumber"], message: "window numbers must be contiguous" });
    }
  }
  if (windowIds.length !== candidateIds.length || windowIds.some((id, index) => id !== candidateIds[index])) {
    context.addIssue({ code: "custom", path: ["windows"], message: "windows must contain every candidate exactly once in source order" });
  }
});

export type CandidateManifest = z.infer<typeof candidateManifestSchema>;
export type CandidateManifestEntry = z.infer<typeof candidateManifestEntrySchema>;

function windowsFor(candidates: readonly CandidateManifestEntry[]): readonly z.infer<typeof candidateManifestWindowSchema>[] {
  return Array.from({ length: Math.ceil(candidates.length / candidateManifestWindowSize) }, (_, index) => ({
    batchNumber: index + 1,
    candidateIds: candidates.slice(index * candidateManifestWindowSize, (index + 1) * candidateManifestWindowSize).map((candidate) => candidate.id),
  }));
}

export function candidateTermsSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createCandidateManifest(
  candidates: readonly CandidateManifestEntry[],
  sourceSha256: string,
): CandidateManifest {
  const orderedCandidates = [...candidates].sort((left, right) => compareCodePoints(left.normalized, right.normalized)
    || compareCodePoints(left.id, right.id));
  return candidateManifestSchema.parse({
    schemaVersion: 1,
    source: { candidateTermsSha256: sourceSha256, candidateCount: orderedCandidates.length },
    summary: { candidateCount: orderedCandidates.length, windowCount: Math.ceil(orderedCandidates.length / candidateManifestWindowSize), maxWindowSize: candidateManifestWindowSize },
    candidates: orderedCandidates,
    windows: windowsFor(orderedCandidates),
  });
}

export function parseCandidateManifestJson(body: string): CandidateManifest {
  return candidateManifestSchema.parse(JSON.parse(body));
}

export function candidateManifestJson(manifest: CandidateManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function manifestMatchesCandidateTermsSource(manifest: CandidateManifest, bytes: Uint8Array): boolean {
  return manifest.source.candidateTermsSha256 === candidateTermsSha256(bytes);
}

function isWithin(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !relativePath.startsWith(sep));
}

export function isProtectedCandidateManifestOutputPath(outputPath: string, root = process.cwd()): boolean {
  const output = resolve(root, outputPath);
  return ["data", "src/generated", "public/generated"].some((path) => {
    const protectedRoot = resolve(root, path);
    return isWithin(protectedRoot, output) || isWithin(canonicalPath(protectedRoot), canonicalPath(output));
  });
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function canonicalPath(path: string): string {
  const missingSegments: string[] = [];
  let current = path;
  for (;;) {
    try {
      return resolve(realpathSync(current), ...missingSegments);
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
      const parent = dirname(current);
      if (parent === current) return path;
      missingSegments.unshift(basename(current));
      current = parent;
    }
  }
}

function assertOutputPathHasNoSymbolicLinks(outputPath: string): void {
  const paths: string[] = [];
  let current = outputPath;
  for (;;) {
    paths.unshift(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const path of paths) {
    try {
      if (lstatSync(path).isSymbolicLink()) {
        throw new DataError("arguments", `refusing to write candidate artifact through symbolic link ${path}`);
      }
    } catch (error) {
      if (isMissingPathError(error)) continue;
      throw error;
    }
  }
}

export function assertSafeCandidateArtifactOutputPath(outputPath: string, root = process.cwd()): string {
  const output = resolve(root, outputPath);
  assertOutputPathHasNoSymbolicLinks(output);
  if (isProtectedCandidateManifestOutputPath(output, root)) {
    throw new DataError("arguments", `refusing to write candidate artifact under protected path ${outputPath}`);
  }
  return output;
}

export type CandidateArtifactWriteHooks = {
  readonly beforeRename?: () => void;
};

function assertArtifactTargetIsNotSymbolicLink(path: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      throw new DataError("arguments", `refusing to write candidate artifact through symbolic link ${path}`);
    }
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }
}
function assertAnchoredArtifactOutputIsNotProtected(path: string): void {
  if (isProtectedCandidateManifestOutputPath(path)) {
    throw new DataError("arguments", `refusing to write candidate artifact under protected path ${path}`);
  }
}


export function writeCandidateArtifactFile(
  outputPath: string,
  contents: string,
  hooks: CandidateArtifactWriteHooks = {},
): void {
  const output = assertSafeCandidateArtifactOutputPath(outputPath);
  const parent = dirname(output);
  mkdirSync(parent, { recursive: true });
  assertSafeCandidateArtifactOutputPath(output);
  const parentDescriptor = openSync(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const anchoredParent = process.platform === "linux" ? `/proc/self/fd/${parentDescriptor}` : realpathSync(parent);
  const anchoredOutput = resolve(anchoredParent, basename(output));
  const temporary = resolve(anchoredParent, `.${basename(output)}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    realpathSync(anchoredParent);
    assertAnchoredArtifactOutputIsNotProtected(anchoredOutput);
    assertArtifactTargetIsNotSymbolicLink(anchoredOutput);
    descriptor = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY, 0o600);
    writeFileSync(descriptor, contents, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    hooks.beforeRename?.();
    assertAnchoredArtifactOutputIsNotProtected(anchoredOutput);
    assertArtifactTargetIsNotSymbolicLink(anchoredOutput);
    renameSync(temporary, anchoredOutput);
    if (process.platform !== "win32") fsyncSync(parentDescriptor);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    try {
      unlinkSync(temporary);
    } catch (cleanupError) {
      if (!isMissingPathError(cleanupError)) throw cleanupError;
    }
    throw error;
  } finally {
    closeSync(parentDescriptor);
  }
}
