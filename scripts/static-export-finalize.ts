import { lstat, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertCandidatesUnreferenced,
  assertRuntimeArtifactsAbsent,
  classifyRemovalCandidates,
  type ExportArtifact,
  classifyRemovableBuildDirectories,
  type ExportDirectory,
} from "./static-export-artifacts";
import { finalizeHtmlDocument } from "./static-export-html";
import { assertHydrationFreeTree, StaticExportPolicyError } from "./static-export-policy";
import { assertAllLocalReferences } from "./static-export-references";

type FinalizeOptions = {
  readonly check?: boolean;
};

type ExportTree = {
  readonly directories: readonly ExportDirectory[];
  readonly files: ReadonlyMap<string, Buffer>;
};

function exportPath(root: string, path: string): string {
  const outputPath = relative(root, path).split("\\").join("/");
  if (outputPath.length === 0 || isAbsolute(outputPath) || outputPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new StaticExportPolicyError(`${path}: unsafe export artifact path`);
  }
  return outputPath;
}

async function loadExportTree(root: string): Promise<ExportTree> {
  if ((await lstat(root)).isSymbolicLink()) throw new StaticExportPolicyError(`${root}: symbolic link export root is unsafe`);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const directories: ExportDirectory[] = [];
  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    const path = join(entry.parentPath, entry.name);
    if (entry.isSymbolicLink()) throw new StaticExportPolicyError(`${exportPath(root, path)}: symbolic link export artifact is unsafe`);
    if (entry.isDirectory()) directories.push({ path: exportPath(root, path) });
    if (entry.isFile()) files.set(exportPath(root, path), await readFile(path));
  }
  return { directories: directories.sort((left, right) => left.path.localeCompare(right.path)), files };
}

function artifacts(files: ReadonlyMap<string, Buffer>): readonly ExportArtifact[] {
  return [...files].map(([path, body]) => ({ path, body })).sort((left, right) => left.path.localeCompare(right.path));
}

function finalizeDocuments(files: ReadonlyMap<string, Buffer>): Map<string, Buffer> {
  const finalized = new Map(files);
  for (const [path, body] of files) {
    if (path.endsWith(".html")) finalized.set(path, Buffer.from(finalizeHtmlDocument(body.toString("utf8"), path)));
  }
  return finalized;
}

function assertFinalized(files: ReadonlyMap<string, Buffer>, finalized: ReadonlyMap<string, Buffer>, candidates: readonly string[], directories: readonly string[]): void {
  if (candidates.length > 0) throw new StaticExportPolicyError(`${candidates[0]} is not finalized`);
  if (directories.length > 0) throw new StaticExportPolicyError(`${directories[0]} is not finalized`);
  for (const [path, body] of finalized) {
    const source = files.get(path);
    if (source === undefined || !source.equals(body)) throw new StaticExportPolicyError(`${path} is not finalized`);
  }
}

async function applyPlan(root: string, files: ReadonlyMap<string, Buffer>, finalized: ReadonlyMap<string, Buffer>, candidates: readonly string[], directories: readonly string[]): Promise<void> {
  for (const [path, body] of finalized) {
    const source = files.get(path);
    if (source === undefined || !source.equals(body)) await writeFile(join(root, path), body);
  }
  for (const candidate of candidates) await rm(join(root, candidate));
  for (const directory of directories) await rmdir(join(root, directory));
}

export async function finalizeExportDirectory(root: string, options: FinalizeOptions = {}): Promise<void> {
  const tree = await loadExportTree(root);
  const { files } = tree;
  const finalized = finalizeDocuments(files);
  const prospectiveArtifacts = artifacts(finalized);
  const candidates = classifyRemovalCandidates(prospectiveArtifacts);
  const directories = classifyRemovableBuildDirectories(
    prospectiveArtifacts,
    tree.directories,
    candidates,
  );
  assertCandidatesUnreferenced(prospectiveArtifacts, candidates);
  const candidateSet = new Set(candidates);
  const retained = prospectiveArtifacts.filter((artifact) => !candidateSet.has(artifact.path));
  assertRuntimeArtifactsAbsent(retained);
  assertAllLocalReferences(new Map(retained.map((artifact) => [artifact.path, artifact.body])));
  if (options.check === true) {
    assertFinalized(files, finalized, candidates, directories);
    return;
  }
  await applyPlan(root, files, finalized, candidates, directories);
}

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  await assertHydrationFreeTree(join(repositoryRoot, "src"));
  await finalizeExportDirectory(join(repositoryRoot, "out"), {
    check: process.argv.includes("--check"),
  });
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) await main();
