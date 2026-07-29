import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { createFixture, removeFixture, type FixtureIssue } from "./fixture";
import {
  createSemanticFixture,
  createValidDropFixture,
  type SemanticFixtureIssue,
} from "./semantic-fixture";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function validate(directory: string): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "data:validate", "--", "--data", directory], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function expectInvalidFixture(issue: FixtureIssue, expectedText: string, path?: string): void {
  const directory = createFixture({ issue });
  try {
    const outcome = validate(directory);
    expect(outcome.status).not.toBe(0);
    if (path !== undefined) expect(outcome.output).toContain(path);
    expect(outcome.output).toContain(expectedText);
  } finally {
    removeFixture(directory);
  }
}

function expectInvalidSemanticFixture(issue: SemanticFixtureIssue, expectedText: string): void {
  const directory = createSemanticFixture(issue);
  try {
    const outcome = validate(directory);
    expect(outcome.status).not.toBe(0);
    expect(outcome.output).toContain(expectedText);
  } finally {
    removeFixture(directory);
  }
}

describe("authored data validation", () => {
  it("accepts a minimal valid corpus", () => {
    const directory = createFixture();
    try {
      expect(validate(directory).status).toBe(0);
    } finally {
      removeFixture(directory);
    }
  });

  it("rejects unknown JSON keys", () => {
    expectInvalidFixture("unknown-key", "sources.json");
  });

  it("Given a term without note, when validated, then the file and missing field are reported", () => {
    const directory = createFixture({ issue: "missing-note" });
    try {
      const outcome = validate(directory);
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("terms/sample.json");
      expect(outcome.output).toContain("note");
    } finally {
      removeFixture(directory);
    }
  });

  it("rejects duplicate term IDs", () => {
    expectInvalidFixture("duplicate-id", "duplicate term id");
  });

  it("rejects duplicate term slugs", () => {
    expectInvalidFixture("duplicate-slug", "duplicate term slug");
  });

  it("rejects duplicate normalized terms", () => {
    expectInvalidFixture("duplicate-normalized", "duplicate term normalized");
  });

  it("Given duplicate candidate normalized values, when validated, then the duplicate is rejected", () => {
    expectInvalidFixture("duplicate-candidate-normalized", "duplicate candidate normalized diabetes");
  });

  it("Given a candidate colliding with a verified term, when validated, then the candidate is rejected", () => {
    expectInvalidFixture("candidate-term-collision", "candidate normalized prerootia collides with a verified term");
  });

  it.each([
    ["duplicate-part-source", "word-parts/prefixes.json"],
    ["duplicate-term-source", "terms/sample.json"],
    ["duplicate-alias-source", "aliases.json"],
    ["duplicate-relation-source", "relations.json"],
  ] as const)("Given duplicate citation IDs in %s, when validated, then %s reports the duplicate", (issue, path) => {
    expectInvalidFixture(issue, "sources.1: duplicate source ID source:test", path);
  });

  it("rejects dangling source references", () => {
    const directory = createFixture({ issue: "dangling-source" });
    try {
      const outcome = validate(directory);
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("terms/sample.json");
      expect(outcome.output).toContain("term:sample");
      expect(outcome.output).toContain("source:missing");
    } finally {
      removeFixture(directory);
    }
  });

  it("rejects dangling part references", () => {
    expectInvalidFixture("dangling-part", "root:missing");
  });

  it("rejects dangling relation references", () => {
    expectInvalidFixture("dangling-relation", "term:missing");
  });

  it("rejects a part stored in the wrong category", () => {
    expectInvalidFixture("invalid-part-kind", "prefixes.json");
  });

  it("rejects invalid segment positions", () => {
    expectInvalidFixture("invalid-position", "start");
  });

  it("rejects overlapping segment spans", () => {
    expectInvalidFixture("overlap", "contiguous");
  });

  it("rejects out-of-range segment spans", () => {
    expectInvalidFixture("out-of-range", "span");
  });

  it("rejects analyses that do not reconstruct the term", () => {
    expectInvalidFixture("non-reconstruction", "reconstruct");
  });

  it("rejects transformation rules that do not apply to a part", () => {
    expectInvalidFixture("invalid-transformation", "drop_terminal_vowel");
  });

  it("rejects duplicate relations", () => {
    expectInvalidFixture("duplicate-relation", "duplicate relation");
  });

  it("rejects self relations", () => {
    expectInvalidFixture("self-relation", "self relation");
  });

  it.each([
    ["wrong-source-namespace", "source ID must use source: namespace"],
    ["wrong-term-namespace", "term ID must use term: namespace"],
    ["wrong-analysis-namespace", "analysis ID must use analysis: namespace"],
    ["wrong-prefix-namespace", "part ID must use prefix: namespace for kind prefix"],
    ["wrong-root-namespace", "part ID must use root: namespace for kind root"],
    ["wrong-suffix-namespace", "part ID must use suffix: namespace for kind suffix"],
    ["wrong-combining-namespace", "part ID must use combining: namespace for kind combiningForm"],
  ] as const)("Given %s, when validated, then the semantic ID namespace is rejected", (issue, diagnostic) => {
    expectInvalidSemanticFixture(issue, diagnostic);
  });

  it("Given an alias normalized unlike its alias, when validated, then the mismatch is rejected", () => {
    expectInvalidSemanticFixture(
      "alias-normalized-mismatch",
      "alias samplealias normalized different must equal samplealias",
    );
  });

  it("Given a term normalized unlike its authored term, when validated, then the mismatch is rejected", () => {
    expectInvalidSemanticFixture(
      "term-normalized-mismatch",
      "term term:sample normalized different must equal prerootia",
    );
  });

  it("Given duplicate analysis IDs in one term, when validated, then the second ID is rejected", () => {
    expectInvalidSemanticFixture(
      "duplicate-analysis-within-term",
      "term:sample: duplicate analysis id analysis:sample; first in terms/sample.json: term:sample",
    );
  });

  it("Given duplicate analysis IDs across terms, when validated, then the global duplicate is rejected", () => {
    expectInvalidSemanticFixture(
      "duplicate-analysis-across-terms",
      "term:second: duplicate analysis id analysis:sample; first in terms/sample.json: term:sample",
    );
  });

  it.each([
    "drop-at-end",
    "drop-before-unresolved",
    "drop-before-root",
    "drop-before-combining",
    "drop-before-consonant-suffix",
  ] as const)("Given %s, when validated, then the dropped combining vowel context is rejected", (issue) => {
    expectInvalidSemanticFixture(
      issue,
      "drop_terminal_vowel must be immediately followed by a contiguous vowel-start suffix",
    );
  });

  it("Given glyc/o dropped immediately before -emia, when validated, then the authored analysis is accepted", () => {
    const directory = createValidDropFixture();
    try {
      expect(validate(directory).status).toBe(0);
    } finally {
      removeFixture(directory);
    }
  });
});
