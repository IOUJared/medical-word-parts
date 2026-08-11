import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { candidateTerms } from "../../src/generated/candidates";
import { corpus } from "../../src/generated/corpus";
import { candidateTermSearchIndex, relatedTermIds, sourceCitations } from "../../src/generated/index";
import candidateDispositionsJson from "../../data/candidate-dispositions.json";
import { candidateDispositionsDocumentSchema } from "../../src/data/schemas";

const repositoryRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let generatedDirectory = "";
const generatedNames = ["candidates.ts", "corpus.ts", "index.ts", "routes.ts", "segmentation.ts"] as const;
const generatedHeader = "// GENERATED FILE. DO NOT EDIT. Run npm run data:build to regenerate.\n\n";
const verifiedTermTarget = 298;
const originalCandidateTermCount = 1_057;
const candidateDispositionsDocument = candidateDispositionsDocumentSchema.parse(candidateDispositionsJson);

function build(): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "data:build", "--", "--output", generatedDirectory], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function validateGeneratedOutput(): { readonly status: number | null; readonly output: string } {
  const outcome = spawnSync(npmCommand, ["run", "data:validate", "--", "--output", generatedDirectory], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return { status: outcome.status, output: `${outcome.stdout}${outcome.stderr}` };
}

function digestGeneratedFiles(directory = generatedDirectory): readonly string[] {
  return generatedNames.map((name) => {
    const contents = readFileSync(join(directory, name));
    return createHash("sha256").update(contents).digest("hex");
  });
}

describe("deterministic corpus generation", () => {
  beforeEach(() => {
    generatedDirectory = mkdtempSync(join(tmpdir(), "openword-generated-"));
  });

  afterEach(() => {
    rmSync(generatedDirectory, { recursive: true, force: true });
  });

  it("keeps the generated related-term index symmetric", () => {
    for (const [termId, relatedIds] of Object.entries(relatedTermIds)) {
      for (const relatedId of relatedIds) {
        expect(Object.entries(relatedTermIds).find(([candidateId]) => candidateId === relatedId)?.[1]).toContain(termId);
      }
    }
  });

  it("emits stable, lexically sorted generated modules", () => {
    expect(build().status).toBe(0);
    const firstDigests = digestGeneratedFiles();
    expect(build().status).toBe(0);
    expect(digestGeneratedFiles()).toEqual(firstDigests);

    const routes = readFileSync(join(generatedDirectory, "routes.ts"), "utf8");
    const routeSlugs = (routes.match(/"[a-z]+"/g) ?? []).map((value) => value.slice(1, -1));
    const corpusSlugs = corpus.terms.map((term) => term.slug).sort();
    expect(routeSlugs).toEqual([...routeSlugs].sort());
    expect(routeSlugs).toEqual(corpusSlugs);
  });

  it("includes the requested verified term coverage", () => {
    expect(corpus.terms).toHaveLength(verifiedTermTarget);
  });

  it("emits an empty active candidate index backed by complete disposition provenance", () => {
    const dispositionIds = new Set(
      candidateDispositionsDocument.candidateDispositions.map((disposition) => disposition.originalCandidateId),
    );

    expect(candidateTerms).toEqual([]);
    expect(candidateTermSearchIndex).toEqual({});
    expect(candidateDispositionsDocument.candidateDispositions).toHaveLength(originalCandidateTermCount);
    expect(dispositionIds.size).toBe(originalCandidateTermCount);
    expect(candidateDispositionsDocument.candidateDispositions.every((disposition) => disposition.reviewSources.length > 0)).toBe(true);
    expect(Object.values(sourceCitations).every((citation) => citation.candidateTerms.length === 0)).toBe(true);
  });

  it("keeps generated headers separated from module contents", () => {
    expect(build().status).toBe(0);

    for (const name of generatedNames) {
      expect(readFileSync(join(generatedDirectory, name), "utf8").startsWith(generatedHeader)).toBe(true);
    }
  });

  it("builds into an isolated output without changing canonical generated hashes", () => {
    const canonicalDirectory = join(repositoryRoot, "src", "generated");
    const before = digestGeneratedFiles(canonicalDirectory);

    expect(build().status).toBe(0);

    expect(digestGeneratedFiles(canonicalDirectory)).toEqual(before);
  });

  it("includes exact required analyses and all part categories in generated data", () => {
    expect(build().status).toBe(0);
    const corpusPath = join(generatedDirectory, "corpus.ts");
    expect(existsSync(corpusPath)).toBe(true);
    const corpus = readFileSync(corpusPath, "utf8");

    expect(corpus).toContain('"id": "term:adrenal"');
    expect(corpus).toContain('"partId": "prefix:ad"');
    expect(corpus).toContain('"partId": "root:ren"');
    expect(corpus).toContain('"partId": "suffix:al"');
    expect(corpus).toContain('"partId": "root:adren"');
    expect(corpus).toContain('"id": "term:cytokine"');
    expect(corpus).toContain('"partId": "combining:cyt-o"');
    expect(corpus).toContain('"partId": "suffix:kine"');
    expect(corpus).toContain('"id": "term:hypoglycemia"');
    expect(corpus).toContain('"partId": "prefix:hypo"');
    expect(corpus).toContain('"partId": "combining:glyc-o"');
    expect(corpus).toContain('"kind": "drop_terminal_vowel"');
    expect(corpus).toContain('"partId": "suffix:emia"');
    expect(corpus).toContain('"kind": "prefix"');
    expect(corpus).toContain('"kind": "root"');
    expect(corpus).toContain('"kind": "suffix"');
    expect(corpus).toContain('"kind": "combiningForm"');
  });

  it("precomputes immutable segmentation surfaces for the browser analyzer", () => {
    expect(build().status).toBe(0);
    const segmentationPath = join(generatedDirectory, "segmentation.ts");

    expect(existsSync(segmentationPath)).toBe(true);
    const segmentation = readFileSync(segmentationPath, "utf8");
    expect(segmentation).toContain('"surface": "glyco"');
    expect(segmentation).toContain('"surface": "glyc"');
    expect(segmentation).toContain('"kind": "drop_terminal_vowel"');
    expect(Buffer.byteLength(segmentation)).toBeLessThanOrEqual(18_300);
  });

  it("rejects stale generated output without rewriting it", () => {
    expect(build().status).toBe(0);
    const routesPath = join(generatedDirectory, "routes.ts");
    const original = readFileSync(routesPath, "utf8");
    try {
      writeFileSync(routesPath, `${original}\n// stale output probe\n`);
      const outcome = validateGeneratedOutput();
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("src/generated/routes.ts");
      expect(outcome.output).toContain("npm run data:build");
    } finally {
      writeFileSync(routesPath, original);
    }
  });

  it("rejects missing generated output without creating it", () => {
    expect(build().status).toBe(0);
    const routesPath = join(generatedDirectory, "routes.ts");
    const backupPath = join(generatedDirectory, "routes.ts.backup");
    renameSync(routesPath, backupPath);
    try {
      const outcome = validateGeneratedOutput();
      expect(outcome.status).not.toBe(0);
      expect(outcome.output).toContain("src/generated/routes.ts");
      expect(outcome.output).toContain("npm run data:build");
      expect(existsSync(routesPath)).toBe(false);
    } finally {
      renameSync(backupPath, routesPath);
    }
  });

  it("rejects obsolete extra generated output without rewriting it", () => {
    expect(build().status).toBe(0);
    const obsoletePath = join(generatedDirectory, "obsolete.ts");
    writeFileSync(obsoletePath, "// obsolete generated output\n");

    const outcome = validateGeneratedOutput();

    expect(outcome.status).not.toBe(0);
    expect(outcome.output).toContain(
      "src/generated/obsolete.ts: obsolete generated output; run npm run data:build",
    );
    expect(existsSync(obsoletePath)).toBe(true);
  });

  it("replaces the generated output set without leaving obsolete files", () => {
    expect(build().status).toBe(0);
    const obsoletePath = join(generatedDirectory, "obsolete.ts");
    writeFileSync(obsoletePath, "// obsolete generated output\n");

    expect(build().status).toBe(0);

    expect(existsSync(obsoletePath)).toBe(false);
    expect(validateGeneratedOutput().status).toBe(0);
  });
});
