import {
  parseCandidateDecompositionBatchArtifactJson,
  parseCandidateDefinitionBatchArtifactJson,
} from "./candidate-batch-artifacts";
import { parseCandidateManifestJson } from "./candidate-manifest";

export type CandidateBatchCoverageWorkflow = "definition" | "decomposition";

export type CandidateBatchCoverageInput = {
  readonly workflow: CandidateBatchCoverageWorkflow;
  readonly manifestJson: string;
  readonly currentSourceSha256: string;
  readonly excludedCandidateIds: readonly string[];
  readonly artifacts: readonly { readonly path: string; readonly body: string }[];
};

export type CandidateBatchCoverageSummary = {
  readonly schemaVersion: 1;
  readonly workflow: CandidateBatchCoverageWorkflow;
  readonly manifestCandidateCount: number;
  readonly includedCandidateCount: number;
  readonly excludedCandidateCount: number;
  readonly accountedCandidateCount: number;
  readonly artifactCount: number;
};

export class CandidateBatchCoverageError extends Error {
  override readonly name = "CandidateBatchCoverageError";

  constructor(readonly detail: string) {
    super(detail);
  }
}

function artifactCandidateIds(workflow: CandidateBatchCoverageWorkflow, body: string): readonly string[] {
  switch (workflow) {
    case "definition":
      return parseCandidateDefinitionBatchArtifactJson(body).candidates.map((candidate) => candidate.candidateId);
    case "decomposition":
      return parseCandidateDecompositionBatchArtifactJson(body).candidates.map((candidate) => candidate.candidateId);
  }
}

function exclusionSet(ids: readonly string[], manifestIds: ReadonlySet<string>): ReadonlySet<string> {
  const exclusions = new Set<string>();
  for (const id of ids) {
    if (!manifestIds.has(id)) throw new CandidateBatchCoverageError(`excluded candidate is not frozen: ${id}`);
    if (exclusions.has(id)) throw new CandidateBatchCoverageError(`duplicate excluded candidate: ${id}`);
    exclusions.add(id);
  }
  return exclusions;
}

export function checkCandidateBatchCoverage(input: CandidateBatchCoverageInput): CandidateBatchCoverageSummary {
  const manifest = parseCandidateManifestJson(input.manifestJson);
  if (manifest.source.candidateTermsSha256 !== input.currentSourceSha256) {
    throw new CandidateBatchCoverageError("candidate source hash drifted from frozen manifest");
  }
  const manifestIds = new Set(manifest.candidates.map((candidate) => candidate.id));
  const exclusions = exclusionSet(input.excludedCandidateIds, manifestIds);
  const included = new Set<string>();
  for (const artifact of input.artifacts) {
    for (const id of artifactCandidateIds(input.workflow, artifact.body)) {
      if (!manifestIds.has(id)) throw new CandidateBatchCoverageError(`${artifact.path}: stale candidate ID ${id}`);
      if (exclusions.has(id)) throw new CandidateBatchCoverageError(`${artifact.path}: excluded candidate ID ${id} was included`);
      if (included.has(id)) throw new CandidateBatchCoverageError(`${artifact.path}: duplicate candidate ID ${id}`);
      included.add(id);
    }
  }
  const missing = manifest.candidates.find((candidate) => !exclusions.has(candidate.id) && !included.has(candidate.id));
  if (missing !== undefined) throw new CandidateBatchCoverageError(`missing candidate ID ${missing.id}`);
  return {
    schemaVersion: 1,
    workflow: input.workflow,
    manifestCandidateCount: manifest.candidates.length,
    includedCandidateCount: included.size,
    excludedCandidateCount: exclusions.size,
    accountedCandidateCount: included.size + exclusions.size,
    artifactCount: input.artifacts.length,
  };
}
