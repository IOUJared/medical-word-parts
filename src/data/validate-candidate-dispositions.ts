import type { Located } from "./load";
import { parseCandidateManifestJson } from "./candidate-manifest";
import type { CandidateDisposition, CandidateTerm } from "./schemas";

type CandidateDispositionValidation = {
  readonly dispositions: readonly Located<CandidateDisposition>[];
  readonly candidateTerms: readonly Located<CandidateTerm>[];
  readonly termIds: ReadonlySet<string>;
  readonly sourceIds: ReadonlySet<string>;
  readonly errors: string[];
};

export type CandidateDispositionArchiveValidation = {
  readonly manifestJson: string;
  readonly currentSourceSha256: string;
  readonly activeCandidates: readonly {
    readonly id: string;
    readonly normalized: string;
  }[];
  readonly dispositions: readonly {
    readonly originalCandidateId: string;
    readonly originalNormalized: string;
  }[];
};

export type CandidateDispositionArchiveSummary = {
  readonly manifestCandidateCount: number;
  readonly dispositionCandidateCount: number;
};

export class CandidateDispositionArchiveError extends Error {
  override readonly name = "CandidateDispositionArchiveError";

  constructor(readonly detail: string) {
    super(detail);
  }
}

export function checkCandidateDispositionArchive(
  input: CandidateDispositionArchiveValidation,
): CandidateDispositionArchiveSummary {
  const manifest = parseCandidateManifestJson(input.manifestJson);
  const activeCandidates = input.activeCandidates;
  if (activeCandidates.length > 0 && manifest.source.candidateTermsSha256 !== input.currentSourceSha256) {
    throw new CandidateDispositionArchiveError("candidate source hash drifted from frozen manifest");
  }
  const manifestIds = new Set(manifest.candidates.map((candidate) => candidate.id));
  const manifestNormalizedById = new Map(manifest.candidates.map((candidate) => [candidate.id, candidate.normalized]));
  const activeCandidateIds = new Set<string>();
  for (const candidate of activeCandidates) {
    if (activeCandidateIds.has(candidate.id)) {
      throw new CandidateDispositionArchiveError(`duplicate active candidate ${candidate.id}`);
    }
    const manifestNormalized = manifestNormalizedById.get(candidate.id);
    if (manifestNormalized === undefined) {
      throw new CandidateDispositionArchiveError(`stale active candidate ID ${candidate.id}`);
    }
    if (candidate.normalized !== manifestNormalized) {
      throw new CandidateDispositionArchiveError(`active candidate identity does not match frozen manifest ${candidate.id}`);
    }
    activeCandidateIds.add(candidate.id);
  }
  const dispositionIds = new Set<string>();
  for (const disposition of input.dispositions) {
    const candidateId = disposition.originalCandidateId;
    if (dispositionIds.has(candidateId)) {
      throw new CandidateDispositionArchiveError(`duplicate candidate disposition ${candidateId}`);
    }
    if (!manifestIds.has(candidateId)) {
      throw new CandidateDispositionArchiveError(`stale candidate ID ${candidateId}`);
    }
    if (activeCandidateIds.has(candidateId)) {
      throw new CandidateDispositionArchiveError(`active candidate identity collision ${candidateId}`);
    }
    if (disposition.originalNormalized !== manifestNormalizedById.get(candidateId)) {
      throw new CandidateDispositionArchiveError(`original identity does not match frozen manifest ${candidateId}`);
    }
    dispositionIds.add(candidateId);
  }
  const missingCount = manifest.candidates.filter(
    (candidate) => !activeCandidateIds.has(candidate.id) && !dispositionIds.has(candidate.id),
  ).length;
  if (missingCount > 0) {
    throw new CandidateDispositionArchiveError(
      `candidate disposition archive is missing ${missingCount} candidate IDs from frozen manifest`,
    );
  }
  return {
    manifestCandidateCount: manifest.candidates.length,
    dispositionCandidateCount: dispositionIds.size,
  };
}

export function checkCandidateDispositions(input: CandidateDispositionValidation): void {
  const activeCandidates = new Map(input.candidateTerms.map((record) => [record.value.id, record.value]));
  const dispositionCandidateIds = new Set<string>();
  for (const disposition of input.dispositions) {
    const value = disposition.value;
    if (dispositionCandidateIds.has(value.originalCandidateId)) {
      input.errors.push(`${disposition.path}: duplicate candidate disposition ${value.originalCandidateId}`);
    }
    dispositionCandidateIds.add(value.originalCandidateId);

    const activeCandidate = activeCandidates.get(value.originalCandidateId);
    if (activeCandidate !== undefined
      && (activeCandidate.term !== value.originalTerm || activeCandidate.normalized !== value.originalNormalized)) {
      input.errors.push(`${disposition.path}: original identity does not match active candidate ${value.originalCandidateId}`);
    }
    for (const sourceId of value.reviewSources) {
      if (!input.sourceIds.has(sourceId)) {
        input.errors.push(`${disposition.path}: ${value.originalCandidateId}: dangling source ${sourceId}`);
      }
    }
    if (value.outcome === "promoted_verified_term" && !input.termIds.has(value.promotedTermId)) {
      input.errors.push(`${disposition.path}: dangling disposition term ${value.promotedTermId}`);
    }
  }
}
