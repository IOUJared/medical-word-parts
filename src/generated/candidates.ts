// GENERATED FILE. DO NOT EDIT. Run npm run data:build to regenerate.

import type { corpus } from "./corpus";

type CandidateTerm = {
  readonly id: `candidate:${string}`;
  readonly term: string;
  readonly normalized: string;
  readonly status: "candidate";
  readonly sources: readonly (typeof corpus.sources)[number]["id"][];
  readonly sourceVersion: string;
  readonly license: string;
  readonly aliases?: readonly string[];
  readonly externalIds?: Readonly<Record<string, string>>;
};

export const candidateTerms: readonly CandidateTerm[] = [];
