import { describe, expect, it } from "vitest";

import { assertAuditSummary, categoryNames, type AuditScores, type AuditSummary, type FailedResource } from "../../scripts/audit-policy";
import { productionBrowserChannel } from "../../scripts/production-audit";

const perfectScores = {
  performance: 100,
  accessibility: 100,
  "best-practices": 100,
  seo: 100,
} satisfies AuditScores;

type SummaryOptions = {
  readonly scores?: AuditScores;
  readonly cls?: readonly number[];
  readonly failedResources?: readonly FailedResource[];
  readonly nextRuntimeResources?: readonly string[];
};

function summary(options: SummaryOptions = {}): AuditSummary {
  return {
    route: "fixture",
    preset: "mobile",
    scores: options.scores ?? perfectScores,
    cls: options.cls ?? [0, 0, 0],
    runs: [{ failedResources: options.failedResources ?? [], nextRuntimeResources: options.nextRuntimeResources ?? [] }],
  };
}

describe("production audit policy", () => {
  it("Given the production audit launcher, when Chrome is selected, then Lighthouse runs against the real browser channel", () => {
    expect(productionBrowserChannel).toBe("chrome");
  });

  it.each(categoryNames)("Given a %s median below 100, when policy runs, then the audit is rejected", (category) => {
    const scores = { ...perfectScores, [category]: 99 };

    expect(() => assertAuditSummary(summary({ scores }))).toThrow(`${category} score must equal 100`);
  });

  it("Given cold CLS above the budget, when policy runs, then the audit is rejected", () => {
    expect(() => assertAuditSummary(summary({ cls: [0, 0.02, 0] }))).toThrow("cold CLS must not exceed 0.01");
  });

  it("Given a failed resource, when policy runs, then the audit is rejected", () => {
    expect(() => assertAuditSummary(summary({ failedResources: [{ url: "/missing.js", statusCode: 404 }] }))).toThrow("must not load failed resources");
  });

  it("Given a shipped Next browser runtime, when policy runs, then the audit is rejected", () => {
    expect(() => assertAuditSummary(summary({ nextRuntimeResources: ["/_next/static/chunks/runtime.js"] }))).toThrow("must not load Next hydration/runtime scripts");
  });

  it("Given perfect cold runs, when policy runs, then no audit error is raised", () => {
    expect(() => assertAuditSummary(summary())).not.toThrow();
  });
});
