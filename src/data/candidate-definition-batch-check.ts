import {
  parseCandidateDefinitionBatchArtifactJson,
  type SavedCandidateDefinitionBatchArtifact,
} from "./candidate-batch-artifacts";

export type SavedCandidateDefinitionBatch = SavedCandidateDefinitionBatchArtifact;

export function parseCandidateDefinitionBatchJson(body: string): SavedCandidateDefinitionBatch {
  return parseCandidateDefinitionBatchArtifactJson(body);
}
