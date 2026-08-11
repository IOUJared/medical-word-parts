import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const fixtureIssues = [
  "unknown-key",
  "duplicate-id",
  "duplicate-slug",
  "duplicate-normalized",
  "duplicate-candidate-normalized",
  "candidate-term-collision",
  "duplicate-candidate-review",
  "dangling-candidate-review",
  "dangling-candidate-review-source",
  "duplicate-part-source",
  "duplicate-term-source",
  "duplicate-alias-source",
  "duplicate-relation-source",
  "dangling-source",
  "dangling-part",
  "dangling-relation",
  "invalid-part-kind",
  "invalid-position",
  "overlap",
  "out-of-range",
  "non-reconstruction",
  "invalid-transformation",
  "duplicate-relation",
  "self-relation",
  "missing-note",
] as const;

export type FixtureIssue = (typeof fixtureIssues)[number];

type FixtureOptions = {
  readonly issue?: FixtureIssue;
};

type CitationRecord = "part" | "term" | "alias" | "relation";

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function citationSources(issue: FixtureIssue | undefined, record: CitationRecord): readonly string[] {
  return issue === `duplicate-${record}-source` ? ["source:test", "source:test"] : ["source:test"];
}

function makeSegments(issue: FixtureIssue | undefined): readonly object[] {
  if (issue === "invalid-position") {
    return [
      { partId: "prefix:pre", surface: "pre", start: -1, end: 2 },
      { partId: "root:root", surface: "root", start: 3, end: 7 },
      { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
    ];
  }
  if (issue === "overlap") {
    return [
      { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
      { partId: "root:root", surface: "root", start: 2, end: 6 },
      { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
    ];
  }
  if (issue === "out-of-range") {
    return [
      { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
      { partId: "root:root", surface: "root", start: 3, end: 7 },
      { partId: "suffix:ia", surface: "ia", start: 7, end: 10 },
    ];
  }
  if (issue === "non-reconstruction") {
    return [
      { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
      { partId: "root:root", surface: "root", start: 3, end: 7 },
      { partId: "suffix:ia", surface: "ix", start: 7, end: 9 },
    ];
  }
  if (issue === "invalid-transformation") {
    return [
      {
        partId: "prefix:pre",
        surface: "pre",
        start: 0,
        end: 3,
        transformations: [{ kind: "drop_terminal_vowel", vowel: "o" }],
      },
      { partId: "root:root", surface: "root", start: 3, end: 7 },
      { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
    ];
  }
  return [
    { partId: "prefix:pre", surface: "pre", start: 0, end: 3 },
    {
      partId: issue === "dangling-part" ? "root:missing" : "root:root",
      surface: "root",
      start: 3,
      end: 7,
    },
    { partId: "suffix:ia", surface: "ia", start: 7, end: 9 },
  ];
}

export function createFixture(options: FixtureOptions = {}): string {
  const directory = mkdtempSync(join(tmpdir(), "openword-data-"));
  const termsDirectory = join(directory, "terms");
  const partsDirectory = join(directory, "word-parts");
  mkdirSync(termsDirectory);
  mkdirSync(partsDirectory);

  const source = {
    id: "source:test",
    publisher: "Test publisher",
    title: "Test source",
    url: "https://example.test/source",
  };
  const sourceDocument =
    options.issue === "unknown-key"
      ? { sources: [{ ...source, unexpected: true }] }
      : { sources: [source] };
  writeJson(join(directory, "sources.json"), sourceDocument);

  writeJson(join(partsDirectory, "prefixes.json"), {
    parts: [
      {
        id: "prefix:pre",
        kind: options.issue === "invalid-part-kind" ? "root" : "prefix",
        form: "pre-",
        meaning: "before",
        sources: citationSources(options.issue, "part"),
      },
    ],
  });
  writeJson(join(partsDirectory, "roots.json"), {
    parts: [
      {
        id: "root:root",
        kind: "root",
        form: "root-",
        meaning: "test root",
        sources: ["source:test"],
      },
    ],
  });
  writeJson(join(partsDirectory, "suffixes.json"), {
    parts: [
      {
        id: "suffix:ia",
        kind: "suffix",
        form: "-ia",
        meaning: "condition",
        sources: ["source:test"],
      },
    ],
  });
  writeJson(join(partsDirectory, "combining-forms.json"), {
    parts: [
      {
        id: "combining:cyt-o",
        kind: "combiningForm",
        form: "cyt/o",
        meaning: "cell",
        sources: ["source:test"],
      },
    ],
  });

  const term = {
    id: "term:sample",
    slug: "sample",
    term: "prerootia",
    normalized: "prerootia",
    sources: options.issue === "dangling-source" ? ["source:missing"] : citationSources(options.issue, "term"),
    ...(options.issue === "missing-note" ? {} : { note: "A test term record." }),
    analyses: [
      {
        id: "analysis:sample",
        primary: true,
        segments: makeSegments(options.issue),
      },
    ],
  };
  writeJson(join(termsDirectory, "sample.json"), term);
  if (options.issue === "duplicate-id") {
    writeJson(join(termsDirectory, "duplicate.json"), { ...term, slug: "second" });
  }
  if (options.issue === "duplicate-slug") {
    writeJson(join(termsDirectory, "duplicate.json"), { ...term, id: "term:second" });
  }
  if (options.issue === "duplicate-normalized") {
    writeJson(join(termsDirectory, "duplicate.json"), { ...term, id: "term:second", slug: "second" });
  }

  writeJson(join(directory, "aliases.json"), {
    aliases: options.issue === "duplicate-alias-source"
      ? [{ alias: "samplealias", normalized: "samplealias", termId: "term:sample", sources: citationSources(options.issue, "alias") }]
      : [],
  });
  const relationTarget = options.issue === "dangling-relation" ? "term:missing" : "term:sample";
  const relations =
    options.issue === "duplicate-relation-source"
      ? [{ kind: "related", from: "term:sample", to: "term:sample", sources: citationSources(options.issue, "relation") }]
      : options.issue === "duplicate-relation"
      ? [
          { kind: "related", from: "term:sample", to: "term:sample", sources: ["source:test"] },
          { kind: "related", from: "term:sample", to: "term:sample", sources: ["source:test"] },
        ]
      : options.issue === "self-relation"
        ? [{ kind: "related", from: "term:sample", to: "term:sample", sources: ["source:test"] }]
        : options.issue === "dangling-relation"
          ? [{ kind: "related", from: "term:sample", to: relationTarget, sources: ["source:test"] }]
          : [];
  writeJson(join(directory, "relations.json"), { relations });
  const candidateTerm = {
    id: "candidate:diabetes",
    term: "diabetes",
    normalized: options.issue === "candidate-term-collision" ? "prerootia" : "diabetes",
    status: "candidate",
    sources: ["source:test"],
    sourceVersion: "test-fixture",
    license: "test fixture license",
  };
  writeJson(join(directory, "candidate-terms.json"), {
    candidateTerms: options.issue === "duplicate-candidate-normalized"
      ? [candidateTerm, { ...candidateTerm, id: "candidate:diabetes-second" }]
      : [candidateTerm],
  });
  const candidateReviewDecision = {
    candidateId: options.issue === "dangling-candidate-review" ? "candidate:missing" : "candidate:diabetes",
    outcome: "deferred",
    reason: "insufficient_decomposition_evidence",
    reviewSources: options.issue === "dangling-candidate-review-source" ? ["source:missing"] : ["source:test"],
    note: "The reviewed source does not document an exact word-part analysis.",
  };
  writeJson(join(directory, "candidate-review-decisions.json"), {
    candidateReviewDecisions: options.issue === "duplicate-candidate-review"
      ? [candidateReviewDecision, candidateReviewDecision]
      : [candidateReviewDecision],
  });
  writeJson(join(directory, "candidate-dispositions.json"), { candidateDispositions: [] });
  return directory;
}

export function removeFixture(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}
