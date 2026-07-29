import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";

import { StaticExportPolicyError } from "./static-export-policy";

export type ExportArtifact = {
  readonly path: string;
  readonly body: Buffer;
};

export type ExportDirectory = {
  readonly path: string;
};

const nextPayloadPath = /^(?:[A-Za-z0-9._-]+\/)*__next\.[A-Za-z0-9_$.-]+\.txt$/;
const routePayloadPath = /^(?:[A-Za-z0-9._-]+\/)*index\.txt$/;
const nextChunkScript = /^_next\/static\/chunks\/[^/]+\.js$/;
const nextChunkStyle = /^_next\/static\/chunks\/[^/]+\.css$/;
const nextBuildId = /^[A-Za-z0-9_-]{21}$/;
const manifestNames = [
  "_buildManifest.js",
  "_clientMiddlewareManifest.js",
  "_ssgManifest.js",
] as const;
const manifestMarkers: ReadonlyMap<string, readonly string[]> = new Map([
  ["_buildManifest.js", ["self.__BUILD_MANIFEST", "self.__BUILD_MANIFEST_CB"]],
  [
    "_clientMiddlewareManifest.js",
    ["self.__MIDDLEWARE_MATCHERS", "self.__MIDDLEWARE_MATCHERS_CB"],
  ],
  ["_ssgManifest.js", ["self.__SSG_MANIFEST", "self.__SSG_MANIFEST_CB"]],
] as const);
const flightMarkers = ["$Sreact.fragment", "self.__next_f", "__next_f"] as const;
const flightPayload = /(?:^|\n)1:"\$Sreact\.fragment"(?:\n|$)/;
const treePayload = /^(?::HL\[[^\n]+\]\n)*0:\{"tree":.+"buildId":"[A-Za-z0-9_-]{21}"/;
const webpackRegistrationChunk = /^\(self\.webpackChunk_N_E=self\.webpackChunk_N_E\|\|\[\]\)\.push\(\[[\s\S]*\]\);$/;
const turbopackRegistrationChunk = /^\(globalThis\.TURBOPACK\|\|\(globalThis\.TURBOPACK=\[\]\)\)\.push\(\[[\s\S]*\]\);$/;
const turbopackRuntimeChunk = /^\(globalThis\.TURBOPACK\|\|\(globalThis\.TURBOPACK=\[\]\)\)\.push\(\[[\s\S]*\]\),\(\(\)=>\{[\s\S]*\}\)\(\);$/;
const next_16_2_11VendorChunkDigests = new Set([
  "0973c1d64c88adc8e3c950410cb58b288f72118d5965b78049438deb8f2f9683",
]);

function hasFlightPayloadShape(artifact: ExportArtifact): boolean {
  const source = artifact.body.toString("utf8");
  return flightPayload.test(source) || treePayload.test(source);
}

function hasNextChunkShape(artifact: ExportArtifact): boolean {
  const source = artifact.body.toString("utf8");
  return webpackRegistrationChunk.test(source)
    || turbopackRegistrationChunk.test(source)
    || turbopackRuntimeChunk.test(source)
    || next_16_2_11VendorChunkDigests.has(createHash("sha256").update(artifact.body).digest("hex"));
}

function isRoutePayload(artifact: ExportArtifact, paths: ReadonlySet<string>): boolean {
  return routePayloadPath.test(artifact.path) && paths.has(`${dirname(artifact.path)}/index.html`.replace(/^\.\//, ""));
}

function assertSafeArtifactPath(path: string): void {
  if (path.startsWith("/") || path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new StaticExportPolicyError(`${path}: unsafe export artifact path`);
  }
}

export function classifyRemovalCandidates(artifacts: readonly ExportArtifact[]): readonly string[] {
  const paths = new Set(artifacts.map((artifact) => artifact.path));
  for (const artifact of artifacts) assertSafeArtifactPath(artifact.path);
  const buildCandidates = classifyBuildManifestCandidates(artifacts);
  const candidates = [...buildCandidates];
  const buildCandidateSet = new Set(buildCandidates);
  for (const artifact of artifacts) {
    if (buildCandidateSet.has(artifact.path)) continue;
    const name = basename(artifact.path);
    const namedPayload = nextPayloadPath.test(artifact.path);
    const routePayload = isRoutePayload(artifact, paths);
    if (namedPayload || routePayload) {
      if (!hasFlightPayloadShape(artifact)) {
        throw new StaticExportPolicyError(`${artifact.path}: malformed Next payload artifact`);
      }
      candidates.push(artifact.path);
      continue;
    }
    if (nextChunkScript.test(artifact.path)) {
      if (!hasNextChunkShape(artifact)) {
        throw new StaticExportPolicyError(`${artifact.path}: unknown Next chunk artifact`);
      }
      candidates.push(artifact.path);
      continue;
    }
    if (artifact.path.startsWith("_next/static/chunks/") && !nextChunkStyle.test(artifact.path)) {
      throw new StaticExportPolicyError(`${artifact.path}: unknown Next executable artifact`);
    }
    if (artifact.path.startsWith("_next/") && artifact.path.endsWith(".js")) {
      throw new StaticExportPolicyError(`${artifact.path}: unknown Next executable artifact`);
    }
    if (name.startsWith("__next") && artifact.path.endsWith(".txt")) {
      throw new StaticExportPolicyError(`${artifact.path}: malformed Next payload artifact`);
    }
  }
  return candidates.sort();
}

function classifyBuildManifestCandidates(artifacts: readonly ExportArtifact[]): readonly string[] {
  const groups = new Map<string, ExportArtifact[]>();
  for (const artifact of artifacts) {
    const segments = artifact.path.split("/");
    if (segments[0] !== "_next" || segments[1] !== "static" || segments[2] === "chunks" || segments[2] === "media") continue;
    const buildId = segments[2];
    if (buildId === undefined || !nextBuildId.test(buildId)) throw new StaticExportPolicyError(`${artifact.path}: malformed Next build-ID directory`);
    const group = groups.get(buildId) ?? [];
    group.push(artifact);
    groups.set(buildId, group);
  }
  const candidates: string[] = [];
  for (const [buildId, group] of groups) {
    const names = group.map((artifact) => artifact.path.split("/")[3]).filter((name) => name !== undefined).sort();
    const exactSet = group.every((artifact) => artifact.path.split("/").length === 4) && names.length === manifestNames.length && names.every((name, index) => name === [...manifestNames].sort()[index]);
    if (!exactSet) throw new StaticExportPolicyError(`_next/static/${buildId}: unknown Next build manifest set`);
    for (const artifact of group) {
      const name = basename(artifact.path);
      const markers = manifestMarkers.get(name);
      const source = artifact.body.toString("utf8");
      if (markers === undefined || markers.some((marker) => !source.includes(marker))) throw new StaticExportPolicyError(`${artifact.path}: unknown ${name} shape`);
      candidates.push(artifact.path);
    }
  }
  return candidates;
}

function referencesCandidate(source: ExportArtifact, candidate: string): boolean {
  const sourceText = source.body.toString("utf8");
  if (sourceText.includes(candidate)) return true;
  const candidateName = basename(candidate);
  if (nextChunkScript.test(candidate) && sourceText.includes(candidateName)) return true;
  if (manifestMarkers.has(candidateName) && sourceText.includes(dirname(candidate))) return true;
  return dirname(source.path) === dirname(candidate) && sourceText.includes(candidateName);
}

export function removableBuildDirectories(candidates: readonly string[]): readonly string[] {
  return [...new Set(candidates.filter((candidate) => manifestMarkers.has(basename(candidate))).map((candidate) => dirname(candidate)))].sort();
}

export function classifyRemovableBuildDirectories(
  artifacts: readonly ExportArtifact[],
  directories: readonly ExportDirectory[],
  candidates: readonly string[],
): readonly string[] {
  const approvedDirectories = new Set(removableBuildDirectories(candidates));
  const buildDirectories = directories.filter((directory) => {
    const segments = directory.path.split("/");
    return segments[0] === "_next"
      && segments[1] === "static"
      && segments[2] !== "chunks"
      && segments[2] !== "media"
      && segments.length === 3;
  });
  const rootBuildDirectories = directories.filter((directory) => {
    const segments = directory.path.split("/");
    return segments[0] === "_next" && segments[1] !== "static" && segments.length === 2;
  });
  for (const directory of buildDirectories) {
    const buildId = directory.path.split("/")[2];
    if (buildId === undefined || !nextBuildId.test(buildId)) {
      throw new StaticExportPolicyError(`${directory.path}: malformed Next build-ID directory`);
    }
    if (!approvedDirectories.has(directory.path)) {
      throw new StaticExportPolicyError(`${directory.path}: unknown Next build-ID directory`);
    }
    if (directories.some((candidate) => candidate.path.startsWith(`${directory.path}/`))) {
      throw new StaticExportPolicyError(`${directory.path}: unknown Next build manifest set`);
    }
  }
  for (const directory of approvedDirectories) {
    if (!buildDirectories.some((candidate) => candidate.path === directory)) {
      throw new StaticExportPolicyError(`${directory}: missing Next build-ID directory`);
    }
  }
  const knownArtifactPaths = new Set(artifacts.map((artifact) => artifact.path));
  for (const directory of approvedDirectories) {
    if (![...manifestNames].every((name) => knownArtifactPaths.has(`${directory}/${name}`))) {
      throw new StaticExportPolicyError(`${directory}: unknown Next build manifest set`);
    }
  }
  for (const directory of rootBuildDirectories) {
    const buildId = directory.path.split("/")[1];
    if (buildId === undefined || !nextBuildId.test(buildId)
      || directories.some((candidate) => candidate.path.startsWith(`${directory.path}/`))
      || artifacts.some((artifact) => artifact.path.startsWith(`${directory.path}/`))) {
      throw new StaticExportPolicyError(`${directory.path}: unknown Next build-ID directory`);
    }
  }
  return [...approvedDirectories, ...rootBuildDirectories.map((directory) => directory.path)].sort();
}

export function assertCandidatesUnreferenced(artifacts: readonly ExportArtifact[], candidates: readonly string[]): void {
  const candidateSet = new Set(candidates);
  const retained = artifacts.filter((artifact) => !candidateSet.has(artifact.path));
  for (const candidate of candidates) {
    const reference = retained.find((artifact) => referencesCandidate(artifact, candidate));
    if (reference !== undefined) throw new StaticExportPolicyError(`${candidate} is referenced by retained ${reference.path}`);
  }
}

export function assertRuntimeArtifactsAbsent(artifacts: readonly ExportArtifact[]): void {
  const candidates = classifyRemovalCandidates(artifacts);
  if (candidates.length > 0) throw new StaticExportPolicyError(`${candidates[0]} is an unfinalized Next runtime artifact`);
  for (const artifact of artifacts) {
    const source = artifact.body.toString("utf8");
    if (flightMarkers.some((marker) => source.includes(marker))) throw new StaticExportPolicyError(`${artifact.path}: retained Flight token`);
    if (/(?:^|[^A-Za-z0-9])\/?_next\/static\/chunks\/[^"')\s]+\.js/.test(source)) throw new StaticExportPolicyError(`${artifact.path}: retained Next runtime reference`);
  }
}
