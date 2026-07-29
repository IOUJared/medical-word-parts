export const categoryNames = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;

export type CategoryName = (typeof categoryNames)[number];
export type AuditScores = Readonly<Record<CategoryName, number>>;
export type FailedResource = {
  readonly statusCode: number;
  readonly url: string;
};
export type AuditRun = {
  readonly failedResources: readonly FailedResource[];
  readonly nextRuntimeResources: readonly string[];
};
export type AuditSummary = {
  readonly cls: readonly number[];
  readonly preset: string;
  readonly route: string;
  readonly runs: readonly AuditRun[];
  readonly scores: AuditScores;
};

export class AuditPolicyError extends Error {
  override readonly name = "AuditPolicyError";
}

export function median(values: readonly number[]): number {
  const value = [...values].sort((left, right) => left - right)[
    Math.floor(values.length / 2)
  ];
  if (value === undefined) throw new AuditPolicyError("Cannot calculate a median without audit values");
  return value;
}

export function assertAuditSummary(summary: AuditSummary): void {
  for (const category of categoryNames) {
    if (summary.scores[category] !== 100) {
      throw new AuditPolicyError(`${summary.route} ${summary.preset} ${category} score must equal 100`);
    }
  }
  if (summary.cls.some((value) => value > 0.01)) {
    throw new AuditPolicyError(`${summary.route} ${summary.preset} cold CLS must not exceed 0.01`);
  }
  if (summary.runs.some((run) => run.failedResources.length > 0)) {
    throw new AuditPolicyError(`${summary.route} ${summary.preset} must not load failed resources`);
  }
  if (summary.runs.some((run) => run.nextRuntimeResources.length > 0)) {
    throw new AuditPolicyError(`${summary.route} ${summary.preset} must not load Next hydration/runtime scripts`);
  }
}
