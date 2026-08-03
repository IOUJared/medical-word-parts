import { relative, resolve, sep } from "node:path";

import { compareCodePoints } from "./ordering";
import type { CandidateTerm } from "./schemas";
import type { Corpus } from "./validate";

export type MeshDefinition = {
  readonly descriptorId: string;
  readonly descriptorLabel: string;
  readonly conceptId: string;
  readonly definition: string;
  readonly definitionUrl: string;
};

export interface MeshDefinitionClient {
  definitionForDescriptor(descriptorId: string): Promise<MeshDefinition>;
}

export type CandidateDefinitionBatchEntry = {
  readonly candidateId: string;
  readonly term: string;
  readonly normalized: string;
  readonly candidateSources: readonly string[];
} & (
  | {
      readonly status: "mesh_definition";
      readonly sourceVersion: string;
      readonly definition: {
        readonly sourceId: "source:mesh-terms";
        readonly sourceName: string;
        readonly descriptorId: string;
        readonly descriptorLabel: string;
        readonly conceptId: string;
        readonly text: string;
        readonly url: string;
      };
    }
  | {
      readonly status: "source_review_required";
      readonly sourceLeads: readonly {
        readonly sourceId: string;
        readonly sourceName: string;
        readonly url: string;
      }[];
    }
  | {
      readonly status: "definition_fetch_failed";
      readonly sourceVersion: string;
      readonly descriptorId: string;
      readonly error: string;
    }
);

export type CandidateDefinitionBatch = {
  readonly schemaVersion: 1;
  readonly summary: {
    readonly candidateTermCount: number;
    readonly deferredCandidateCount: number;
    readonly includedCandidateCount: number;
    readonly meshDefinitionCount: number;
    readonly sourceReviewLeadCount: number;
    readonly failedDefinitionCount: number;
    readonly batchSize: number;
    readonly batchNumber: number;
    readonly batchStart: number;
    readonly batchEnd: number;
    readonly remainingCandidateCount: number;
  };
  readonly candidates: readonly CandidateDefinitionBatchEntry[];
};

type CandidateDefinitionBatchOptions = {
  readonly limit?: number;
  readonly batchSize?: number;
  readonly batchNumber?: number;
  readonly concurrency?: number;
};

function sourceNameById(corpus: Corpus): ReadonlyMap<string, { readonly title: string; readonly url: string }> {
  return new Map(corpus.sources.map((source) => [source.id, { title: source.title, url: source.url }]));
}

function meshDescriptor(candidate: CandidateTerm): string | undefined {
  return candidate.externalIds?.["meshDescriptor"];
}

function deferredCandidateIds(corpus: Corpus): ReadonlySet<string> {
  return new Set(corpus.candidateReviewDecisions.map((decision) => decision.candidateId));
}

function sourceReviewEntry(
  candidate: CandidateTerm,
  sources: ReadonlyMap<string, { readonly title: string; readonly url: string }>,
): CandidateDefinitionBatchEntry {
  return {
    candidateId: candidate.id,
    term: candidate.term,
    normalized: candidate.normalized,
    candidateSources: candidate.sources,
    status: "source_review_required",
    sourceLeads: candidate.sources.map((sourceId) => ({
      sourceId,
      sourceName: sources.get(sourceId)?.title ?? sourceId,
      url: sources.get(sourceId)?.url ?? "",
    })),
  };
}

function definitionEntry(candidate: CandidateTerm, definition: MeshDefinition): CandidateDefinitionBatchEntry {
  return {
    candidateId: candidate.id,
    term: candidate.term,
    normalized: candidate.normalized,
    status: "mesh_definition",
    candidateSources: candidate.sources,
    sourceVersion: candidate.sourceVersion,
    definition: {
      sourceId: "source:mesh-terms",
      sourceName: "MeSH",
      descriptorId: definition.descriptorId,
      descriptorLabel: definition.descriptorLabel,
      conceptId: definition.conceptId,
      text: definition.definition,
      url: definition.definitionUrl,
    },
  };
}

function failedEntry(candidate: CandidateTerm, descriptorId: string, error: unknown): CandidateDefinitionBatchEntry {
  return {
    candidateId: candidate.id,
    term: candidate.term,
    normalized: candidate.normalized,
    status: "definition_fetch_failed",
    candidateSources: candidate.sources,
    sourceVersion: candidate.sourceVersion,
    descriptorId,
    error: error instanceof Error ? error.message : "unknown definition fetch failure",
  };
}

type CandidateBatchWindow = {
  readonly candidates: readonly CandidateTerm[];
  readonly batchSize: number;
  readonly batchNumber: number;
  readonly batchStart: number;
  readonly batchEnd: number;
  readonly remainingCandidateCount: number;
};

function candidateBatchWindow(corpus: Corpus, options: CandidateDefinitionBatchOptions): CandidateBatchWindow {
  const deferred = deferredCandidateIds(corpus);
  const candidates = corpus.candidateTerms
    .filter((candidate) => !deferred.has(candidate.id))
    .sort((left, right) => compareCodePoints(left.normalized, right.normalized) || compareCodePoints(left.id, right.id));
  const batchSize = options.batchSize ?? options.limit ?? candidates.length;
  const batchNumber = options.batchNumber ?? 1;
  const startIndex = (batchNumber - 1) * batchSize;
  const selected = candidates.slice(startIndex, startIndex + batchSize);
  const batchEnd = startIndex + selected.length;
  return {
    candidates: selected,
    batchSize,
    batchNumber,
    batchStart: selected.length === 0 ? 0 : startIndex + 1,
    batchEnd,
    remainingCandidateCount: Math.max(candidates.length - batchEnd, 0),
  };
}

async function mapConcurrent<Input, Output>(
  inputs: readonly Input[],
  concurrency: number,
  project: (input: Input) => Promise<Output>,
): Promise<readonly Output[]> {
  const results: Output[] = [];
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      const input = inputs[index];
      if (input !== undefined) results[index] = await project(input);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
  return results;
}

async function definitionBatchEntry(
  candidate: CandidateTerm,
  sources: ReadonlyMap<string, { readonly title: string; readonly url: string }>,
  meshClient: MeshDefinitionClient,
): Promise<CandidateDefinitionBatchEntry> {
  const descriptorId = meshDescriptor(candidate);
  if (descriptorId === undefined) return sourceReviewEntry(candidate, sources);
  try {
    return definitionEntry(candidate, await meshClient.definitionForDescriptor(descriptorId));
  } catch (error) {
    return failedEntry(candidate, descriptorId, error);
  }
}

export async function createCandidateDefinitionBatch(
  corpus: Corpus,
  meshClient: MeshDefinitionClient,
  options: CandidateDefinitionBatchOptions = {},
): Promise<CandidateDefinitionBatch> {
  const sources = sourceNameById(corpus);
  const concurrency = options.concurrency ?? 4;
  const window = candidateBatchWindow(corpus, options);
  const entries = await mapConcurrent(
    window.candidates,
    concurrency,
    (candidate) => definitionBatchEntry(candidate, sources, meshClient),
  );
  return {
    schemaVersion: 1,
    summary: {
      candidateTermCount: corpus.candidateTerms.length,
      deferredCandidateCount: corpus.candidateReviewDecisions.length,
      includedCandidateCount: entries.length,
      meshDefinitionCount: entries.filter((entry) => entry.status === "mesh_definition").length,
      sourceReviewLeadCount: entries.filter((entry) => entry.status === "source_review_required").length,
      failedDefinitionCount: entries.filter((entry) => entry.status === "definition_fetch_failed").length,
      batchSize: window.batchSize,
      batchNumber: window.batchNumber,
      batchStart: window.batchStart,
      batchEnd: window.batchEnd,
      remainingCandidateCount: window.remainingCandidateCount,
    },
    candidates: entries,
  };
}

export function candidateDefinitionBatchJson(batch: CandidateDefinitionBatch): string {
  return `${JSON.stringify(batch, null, 2)}\n`;
}

function isWithin(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath.length === 0 || (!relativePath.startsWith("..") && !relativePath.startsWith(sep));
}

export function isProtectedDefinitionOutputPath(outputPath: string, root = process.cwd()): boolean {
  const output = resolve(root, outputPath);
  return ["data", "src/generated", "public/generated"].some((path) => isWithin(resolve(root, path), output));
}
